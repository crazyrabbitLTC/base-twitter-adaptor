import { EventEmitter } from 'events';
import { TwitterService, TwitterServiceConfig, MentionEvent } from './index';

interface LLMToolConfig {
  twitterConfig: TwitterServiceConfig;
}

interface LLMResponse {
  success: boolean;
  message?: string;
  error?: any;
  data?: any;
}

export class LLMToolAdapter extends EventEmitter {
  private twitterService: TwitterService;

  constructor(config: LLMToolConfig) {
    super();
    this.twitterService = new TwitterService(config.twitterConfig);

    this.twitterService.on('newMention', async (mention: MentionEvent) => {
      const formattedResponse = await this.formatMentionForLLM(mention);
      this.emit('newTwitterMessage', formattedResponse);
    });

    this.twitterService.on('rateLimitWarning', (rateLimit) => {
      this.emit('rateLimitWarning', rateLimit);
    });

    this.twitterService.on('pollError', (error) => {
      this.emit('pollError', error);
    });

    this.twitterService.on('tweetError', (error) => {
      this.emit('tweetError', error);
    });
  }

  async start(): Promise<void> {
    await this.twitterService.start();
  }

  async stop(): Promise<void> {
    await this.twitterService.stop();
  }

  private async formatMentionForLLM(mention: MentionEvent): Promise<any> {
    return {
      type: 'new_twitter_message',
      message: mention.message,
      threadId: mention.threadId,
      userId: mention.userId,
      tweetId: mention.tweetId,
    };
  }

  async postTweet(text: string): Promise<LLMResponse> {
    try {
      const tweetResponse = await this.twitterService['twitterClient'].v2.tweet(text);
      return {
        success: true,
        message: "Tweet posted successfully",
        data: tweetResponse.data
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: "Error posting tweet"
      };
    }
  }

  async searchTweets(query: string): Promise<LLMResponse> {
    try {
      const searchResponse = await this.twitterService['twitterClient'].v2.search(query);
      return {
        success: true,
        message: "Search successful",
        data: searchResponse
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: 'Error performing search'
      };
    }
  }

  async replyToTweet(tweetId: string, message: string): Promise<LLMResponse> {
    try {
      const response = await this.twitterService['replyToTweet'](tweetId, message);
      return {
        success: true,
        message: "Reply successful",
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: "Failed to reply to tweet"
      };
    }
  }

  async getMyProfile(): Promise<LLMResponse> {
    try {
      const me = await this.twitterService['twitterClient'].v2.get('users/me');
      return {
        success: true,
        message: "Successfully retrieved user profile",
        data: me.data
      };
    } catch (error) {
      return {
        success: false,
        error,
        message: "Failed to get user profile"
      };
    }
  }
} 