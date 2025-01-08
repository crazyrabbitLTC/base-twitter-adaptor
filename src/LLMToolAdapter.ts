import { TwitterServiceConfig, MentionEvent, RateLimitEvent } from './types';
import { TwitterService } from './TwitterService';
import { EventEmitter } from 'events';

export interface LLMToolAdapterConfig {
  twitterConfig: TwitterServiceConfig;
}

export interface LLMResponse {
  success: boolean;
  message?: string;
  error?: any;
  data?: any;
}

/**
 * Adapter class that provides a clean interface for LLMs to interact with Twitter
 */
export class LLMToolAdapter {
  private twitterService: TwitterService;
  private emitter: EventEmitter;

  public on: (event: string | symbol, listener: (...args: any[]) => void) => EventEmitter;
  public emit: (event: string | symbol, ...args: any[]) => boolean;

  constructor(config: LLMToolAdapterConfig) {
    this.twitterService = new TwitterService(config.twitterConfig);
    this.emitter = new EventEmitter();

    // Bind event emitter methods
    this.on = this.emitter.on.bind(this.emitter);
    this.emit = this.emitter.emit.bind(this.emitter);

    // Set up event listeners
    this.twitterService.on('newMention', (mention: MentionEvent) => {
      this.emit('newTwitterMessage', {
        success: true,
        data: {
          messageId: mention.tweetId,
          threadId: mention.threadId,
          userId: mention.userId,
          content: mention.message
        }
      });
    });

    this.twitterService.on('rateLimitWarning', (warning: RateLimitEvent) => {
      this.emit('rateLimitWarning', {
        success: false,
        error: warning.error,
        message: 'Rate limit reached'
      });
    });

    this.twitterService.on('pollError', (error: any) => {
      this.emit('error', {
        success: false,
        error,
        message: 'Error polling for mentions'
      });
    });

    this.twitterService.on('tweetError', (error: any) => {
      this.emit('error', {
        success: false,
        error,
        message: 'Error sending tweet'
      });
    });
  }

  /**
   * Starts the Twitter service
   */
  public async start(): Promise<LLMResponse> {
    try {
      await this.twitterService.start();
      return {
        success: true,
        message: 'Twitter service started successfully'
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to start Twitter service'
      };
    }
  }

  /**
   * Stops the Twitter service
   */
  public async stop(): Promise<LLMResponse> {
    try {
      await this.twitterService.stop();
      return {
        success: true,
        message: 'Twitter service stopped successfully'
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to stop Twitter service'
      };
    }
  }

  /**
   * Posts a new tweet
   */
  public async postTweet(content: string): Promise<LLMResponse> {
    try {
      const tweet = await this.twitterService.tweet(content);
      return {
        success: true,
        message: 'Tweet posted successfully',
        data: tweet
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to post tweet'
      };
    }
  }

  /**
   * Replies to an existing tweet
   */
  public async replyToTweet(tweetId: string, content: string): Promise<LLMResponse> {
    try {
      const reply = await this.twitterService.replyToTweet(tweetId, content);
      return {
        success: true,
        message: 'Reply posted successfully',
        data: reply
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to post reply'
      };
    }
  }

  /**
   * Gets the authenticated user's profile
   */
  public async getMyProfile(): Promise<LLMResponse> {
    try {
      const profile = await this.twitterService.getMyProfile();
      return {
        success: true,
        data: profile
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to get profile'
      };
    }
  }

  /**
   * Searches for tweets matching a query
   */
  public async searchTweets(query: string): Promise<LLMResponse> {
    try {
      const tweets = await this.twitterService.searchTweets(query);
      return {
        success: true,
        data: tweets
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Failed to search tweets'
      };
    }
  }
} 