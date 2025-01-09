import { TwitterServiceConfig, MentionEvent, Message, ThreadContext, RateLimitEvent } from './types';
import winston from 'winston';
import { EventEmitter } from 'events';
import { TwitterApi, TweetV2, Tweetv2SearchParams } from 'twitter-api-v2';

/**
 * Service for handling Twitter interactions using polling
 */
export class TwitterService {
  private config: TwitterServiceConfig;
  private logger: winston.Logger;
  private emitter: EventEmitter;
  private twitterClient: TwitterApi;
  private threads: Map<string, ThreadContext>;
  private pollInterval?: NodeJS.Timeout;
  private lastMentionId?: string;
  private currentUserId?: string;
  private currentUsername?: string;

  public on: (event: string | symbol, listener: (...args: any[]) => void) => EventEmitter;
  public emit: (event: string | symbol, ...args: any[]) => boolean;

  /**
   * Creates a new instance of TwitterService
   * @param config - Configuration options for the service
   */
  constructor(config: TwitterServiceConfig) {
    this.config = {
      ...config,
      threadHistoryLimit: config.threadHistoryLimit ?? 50,
      pollIntervalMs: config.pollIntervalMs ?? 60000, // Default to 1 minute
      logLevel: config.logLevel ?? 'info', // Default to 'info' if not specified
    };
    this.threads = new Map();
    this.emitter = new EventEmitter();

    // Bind event emitter methods
    this.on = this.emitter.on.bind(this.emitter);
    this.emit = this.emitter.emit.bind(this.emitter);

    // Initialize logger with timestamp and configured level
    this.logger = winston.createLogger({
      level: this.config.logLevel || 'info',
      silent: this.config.logLevel === 'silent',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info: winston.Logform.TransformableInfo) => {
          return `${info.timestamp} [${info.level}]: ${info.message} ${
            Object.keys(info).length > 3 ? JSON.stringify(info) : ''
          }`;
        })
      ),
      transports: [new winston.transports.Console()],
    });

    // Initialize Twitter client with the most specific credentials available
    if (config.accessToken && config.accessTokenSecret) {
      // Use user-specific credentials if available
      this.twitterClient = new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
        accessToken: config.accessToken,
        accessSecret: config.accessTokenSecret,
      });
    } else if (config.bearerToken) {
      // Fall back to bearer token if available
      this.twitterClient = new TwitterApi(config.bearerToken);
    } else {
      // Fall back to app-only credentials
      this.twitterClient = new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
      });
    }

    //set initial lastMentionId based on the config
    this.lastMentionId = config.sinceId;
  }

  /**
   * Starts the Twitter service and polling mechanism
   */
  public async start() {
    try {
      // Get authenticated user info for mention filtering
      const meResponse = await this.twitterClient.v2.get('users/me');
      this.currentUserId = meResponse.data.id;
      this.currentUsername = meResponse.data.username;
      this.logger.info(`Starting service for user @${this.currentUsername} with id ${this.currentUserId}`);

      // Start polling for mentions
      await this.pollForMentions();
      this.pollInterval = setInterval(() => this.pollForMentions(), this.config.pollIntervalMs);

      this.logger.info('Twitter service started');
    } catch (error) {
      this.logger.error('Failed to start Twitter service', { error });
      throw error;
    }
  }

  /**
   * Stops the Twitter service and cleans up resources
   */
  public async stop() {
    try {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = undefined;
      }

      // Clear all event listeners
      this.emitter.removeAllListeners();

      // Clear thread history
      this.threads.clear();

      this.logger.info('Twitter service stopped');
    } catch (error) {
      this.logger.error('Failed to stop Twitter service', { error });
      throw error;
    }
  }

  /**
   * Polls Twitter API for new mentions
   */
  private async pollForMentions() {
    try {

      this.logger.debug('Polling for mentions');
      if (!this.currentUsername) {
        const meResponse = await this.twitterClient.v2.get('users/me');
        this.currentUsername = meResponse.data.username;
        this.currentUserId = meResponse.data.id;
      }

      const query = `@${this.currentUsername}`;
      const searchParameters: Partial<Tweetv2SearchParams> = {
        'tweet.fields': ['conversation_id', 'author_id', 'created_at', 'text', 'id'],
        max_results: 100,
      };

      // Only add since_id if it's a valid value
      if (this.lastMentionId) {
        searchParameters.since_id = this.lastMentionId;
      } else if (this.config.sinceId && this.config.sinceId !== '0') {
        searchParameters.since_id = this.config.sinceId;
      } else {
        this.logger.debug('No sinceId set, using default')
      }

      this.logger.debug('Searching with parameters:', { query, searchParameters });

      const searchResponse = await this.twitterClient.v2.search(query, searchParameters);

      this.logger.debug('Raw Twitter API response:', {
        hasData: !!searchResponse?.data,
        responseData: JSON.stringify(searchResponse?.data),
        meta: searchResponse?.meta,
        includes: searchResponse?.includes,
        fullResponse: JSON.stringify(searchResponse),
      });

      // Early return if no data
      if (!searchResponse?.data?.data) {
        this.logger.debug('No tweets found');
        return;
      }

      // Handle the Twitter API v2 response structure - data is nested inside data
      const tweets = searchResponse.data.data;

      this.logger.debug('Extracted tweets:', { tweets: JSON.stringify(tweets) });

      if (!Array.isArray(tweets)) {
        this.logger.warn('Unexpected response format', { tweets });
        return;
      }

      if (tweets.length === 0) {
        this.logger.debug('No tweets found');
        return;
      }

      // Update last mention ID with the most recent tweet
      if (tweets[0]) {
        this.lastMentionId = tweets[0].id;
        this.logger.debug(`Found ${tweets.length} tweets, lastMentionId is now: ${this.lastMentionId}`);
      } else {
        this.logger.debug('No tweets found, lastMentionId remains:', this.lastMentionId);
      }


      // Process mentions in chronological order (oldest first)
      const tweetsToProcess = [...tweets].reverse();
      for (const tweet of tweetsToProcess) {
        this.logger.debug('Raw tweet data:', { tweet: JSON.stringify(tweet) });

        // Skip tweets from the authenticated user unless configured to include them
        if (tweet.author_id === this.currentUserId && !this.config.includeOwnTweets) {
          this.logger.debug('Skipping own tweet', { tweetId: tweet.id });
          continue;
        }

        // Create tweet data with all available fields
        const tweetData: TweetV2 = {
          text: tweet.text || '',
          id: tweet.id,
          conversation_id: tweet.conversation_id || tweet.id,
          author_id: tweet.author_id || '',
          created_at: tweet.created_at || new Date().toISOString(),
          edit_history_tweet_ids: [tweet.id],
        };

        this.logger.debug('Processing tweet:', {
          original: JSON.stringify(tweet),
          processed: tweetData,
        });

        await this.handleMention({
          tweet: tweetData,
        });
      }
    } catch (error: any) {
      // Enhanced error logging
      this.logger.error('Error polling for mentions', {
        error: error,
        errorMessage: error.message,
        errorStack: error.stack,
        errorData: error.data,
        errorResponse: error.response,
      });

      if (error?.data?.status === 429) {
        const rateLimitEvent: RateLimitEvent = {
          tweetId: '',
          message: '',
          error,
        };
        this.logger.warn('Rate limited when polling for mentions', { error });
        this.emit('rateLimitWarning', rateLimitEvent);
      } else {
        this.emit('pollError', { error });
      }
    }
  }

  /**
   * Processes mention events
   */
  private async handleMention(mention: { tweet: TweetV2 }) {
    this.logger.info('Processing mention', mention);

    const tweet = mention.tweet;
    if (!tweet || !tweet.id) {
      this.logger.warn('Invalid tweet data', { mention });
      return;
    }

    this.logger.info('Processing mention', {
      text: tweet.text,
      id: tweet.id,
    });

    const mentionEvent: MentionEvent = {
      message: tweet.text || '',
      threadId: tweet.conversation_id || tweet.id,
      userId: tweet.author_id || 'unknown',
      tweetId: tweet.id,
    };

    // Add message to thread context
    this.addMessageToThread(mentionEvent.threadId, {
      senderId: mentionEvent.userId,
      timestamp: Date.now(),
      content: mentionEvent.message,
    });

    this.emit('newMention', mentionEvent);
  }

  /**
   * Replies to a tweet with the given message
   */
  public async replyToTweet(tweetId: string, message: string) {
    try {
      const response = await this.twitterClient.v2.tweet({
        text: message,
        reply: {
          in_reply_to_tweet_id: tweetId,
        },
      });
      this.logger.info('Successfully responded to tweet', {
        tweetId,
        message,
        response,
      });
      return response;
    } catch (error: any) {
      if (error?.data?.status === 429) {
        const rateLimitEvent: RateLimitEvent = {
          tweetId,
          message,
          error,
        };
        this.logger.warn('Rate limited when attempting to respond to tweet', rateLimitEvent);
        this.emit('rateLimitWarning', rateLimitEvent);
      } else {
        this.logger.error('Failed to respond to tweet', {
          tweetId,
          message,
          error,
        });
        this.emit('tweetError', { tweetId, message, error });
      }
      throw error;
    }
  }

  /**
   * Gets the context for a thread, creating it if it doesn't exist
   */
  private getThreadContext(threadId: string): ThreadContext {
    if (this.threads.has(threadId)) {
      return this.threads.get(threadId)!;
    } else {
      const newThread = { threadId: threadId, history: [] };
      this.threads.set(threadId, newThread);
      return newThread;
    }
  }

  /**
   * Adds a message to a thread's history, respecting the history limit if set
   */
  private addMessageToThread(threadId: string, message: Message) {
    const threadContext = this.getThreadContext(threadId);
    threadContext.history.push(message);

    // Apply history limit if configured
    if (this.config.threadHistoryLimit && threadContext.history.length > this.config.threadHistoryLimit) {
      threadContext.history = threadContext.history.slice(-this.config.threadHistoryLimit);
    }
  }

  /**
   * Gets the authenticated user's profile
   */
  public async getMyProfile() {
    try {
      const response = await this.twitterClient.v2.get('users/me');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user profile', { error });
      throw error;
    }
  }

  /**
   * Searches for tweets matching a query
   */
  public async searchTweets(query: string) {
    try {
      const searchParameters: Partial<Tweetv2SearchParams> = {
        'tweet.fields': ['conversation_id', 'author_id', 'created_at'],
        max_results: 100,
      };
      const response = await this.twitterClient.v2.search(query, searchParameters);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to search tweets', { error });
      throw error;
    }
  }

  /**
   * Posts a new tweet
   */
  public async tweet(text: string) {
    try {
      const response = await this.twitterClient.v2.tweet(text);
      this.logger.info('Successfully posted tweet', { text });
      return response;
    } catch (error: any) {
      if (error?.data?.status === 429) {
        const rateLimitEvent: RateLimitEvent = {
          tweetId: '',
          message: text,
          error,
        };
        this.logger.warn('Rate limited when attempting to post tweet', rateLimitEvent);
        this.emit('rateLimitWarning', rateLimitEvent);
      } else {
        this.logger.error('Failed to post tweet', { text, error });
        this.emit('tweetError', { message: text, error });
      }
      throw error;
    }
  }

  private isValidTweet(tweet: any): tweet is TweetV2 {
    const requiredFields = ['text', 'id', 'conversation_id', 'author_id', 'created_at'];
    const hasAllFields = requiredFields.every(field => tweet[field] !== undefined && tweet[field] !== null);

    if (!hasAllFields) {
      this.logger.debug('Tweet missing required fields', {
        tweet,
        tweetId: tweet.id,
        missingFields: requiredFields.filter(field => !tweet[field]),
        availableFields: Object.keys(tweet),
      });
    } else {
      this.logger.debug('Tweet passed validation', {
        tweetId: tweet.id,
        fields: requiredFields.map(field => `${field}: ${tweet[field]}`),
      });
    }

    return hasAllFields;
  }
}
