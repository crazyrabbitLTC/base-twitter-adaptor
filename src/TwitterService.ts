import { TwitterServiceConfig, MentionEvent, Message, ThreadContext, RateLimitEvent } from "./types";
import winston from "winston";
import { EventEmitter } from "events";
import { TwitterApi, TweetV2, Tweetv2SearchParams } from "twitter-api-v2";

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
    };
    this.threads = new Map();
    this.emitter = new EventEmitter();

    // Bind event emitter methods
    this.on = this.emitter.on.bind(this.emitter);
    this.emit = this.emitter.emit.bind(this.emitter);

    // Initialize logger with timestamp
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ""
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
      this.pollInterval = setInterval(
        () => this.pollForMentions(),
        this.config.pollIntervalMs
      );

      this.logger.info("Twitter service started");
    } catch (error) {
      this.logger.error("Failed to start Twitter service", { error });
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

      this.logger.info("Twitter service stopped");
    } catch (error) {
      this.logger.error("Failed to stop Twitter service", { error });
      throw error;
    }
  }

  /**
   * Polls Twitter API for new mentions
   */
  private async pollForMentions() {
    try {
      if (!this.currentUsername) {
        const meResponse = await this.twitterClient.v2.get('users/me');
        this.currentUsername = meResponse.data.username;
        this.currentUserId = meResponse.data.id;
      }

      const query = `@${this.currentUsername}`;
      const searchParameters: Partial<Tweetv2SearchParams> = {
        "tweet.fields": ["conversation_id", "author_id", "created_at"],
        since_id: this.lastMentionId,
        max_results: 100
      };

      const searchResponse = await this.twitterClient.v2.search(query, searchParameters);
      
      if (!searchResponse?.data) return;
      
      const tweets = Array.isArray(searchResponse.data) ? searchResponse.data : [searchResponse.data];
      if (tweets.length > 0) {
        this.lastMentionId = tweets[0].id; // Update last mention ID
        
        // Process mentions in chronological order (oldest first)
        for (const mention of [...tweets].reverse()) {
          // Skip tweets with missing required fields
          if (!mention.conversation_id || !mention.author_id || !mention.created_at) {
            this.logger.warn("Incomplete tweet data", { mention });
            continue;
          }

          // Skip tweets from the authenticated user
          if (mention.author_id === this.currentUserId) {
            this.logger.debug("Skipping own tweet", { tweetId: mention.id });
            continue;
          }

          // At this point TypeScript knows these fields are defined
          const tweetData: TweetV2 = {
            text: mention.text,
            id: mention.id,
            conversation_id: mention.conversation_id,
            author_id: mention.author_id,
            created_at: mention.created_at,
            edit_history_tweet_ids: [mention.id]
          };

          await this.handleMention({
            tweet: tweetData
          });
        }
      }
    } catch (error: any) {
      if (error?.data?.status === 429) {
        const rateLimitEvent: RateLimitEvent = {
          tweetId: "",
          message: "",
          error,
        };
        this.logger.warn("Rate limited when polling for mentions", { error });
        this.emit("rateLimitWarning", rateLimitEvent);
      } else {
        this.logger.error("Error polling for mentions", { error });
        this.emit("pollError", { error });
      }
    }
  }

  /**
   * Processes mention events
   */
  private async handleMention(mention: { tweet: TweetV2 }) {
    this.logger.info("Processing mention", mention);

    const tweet = mention.tweet;
    if (!tweet) {
      this.logger.warn("No tweet data in mention", { mention });
      return;
    }

    // Ensure required fields are present
    if (!tweet.text || !tweet.id || !tweet.conversation_id || !tweet.author_id) {
      this.logger.warn("Missing required tweet fields", { tweet });
      return;
    }

    this.logger.info("Valid mention", {
      text: tweet.text,
      id: tweet.id,
    });

    const mentionEvent: MentionEvent = {
      message: tweet.text,
      threadId: tweet.conversation_id,
      userId: tweet.author_id,
      tweetId: tweet.id,
    };

    // Add message to thread context
    this.addMessageToThread(mentionEvent.threadId, {
      senderId: mentionEvent.userId,
      timestamp: Date.now(),
      content: mentionEvent.message,
    });

    this.emit("newMention", mentionEvent);
  }

  /**
   * Replies to a tweet with the given message
   */
  public async replyToTweet(tweetId: string, message: string) {
    try {
      const response = await this.twitterClient.v2.tweet({
        text: message,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      });
      this.logger.info("Successfully responded to tweet", {
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
        this.logger.warn("Rate limited when attempting to respond to tweet", rateLimitEvent);
        this.emit("rateLimitWarning", rateLimitEvent);
      } else {
        this.logger.error("Failed to respond to tweet", {
          tweetId,
          message,
          error,
        });
        this.emit("tweetError", { tweetId, message, error });
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
    if (
      this.config.threadHistoryLimit &&
      threadContext.history.length > this.config.threadHistoryLimit
    ) {
      threadContext.history = threadContext.history.slice(-this.config.threadHistoryLimit);
    }
  }
} 