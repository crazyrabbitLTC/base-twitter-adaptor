import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi } from 'twitter-api-v2';

// Create a minimal mock of TwitterApiv2
const mockTwitterApiv2 = {
  reply: jest.fn(),
  _prefix: '',
  readWrite: {},
  labs: {},
  readOnly: {},
};

// Mock twitter-api-v2
jest.mock('twitter-api-v2', () => {
  return {
    TwitterApi: jest.fn().mockImplementation(() => ({
      v2: mockTwitterApiv2,
    })),
  };
});

const MockedTwitterApi = jest.mocked(TwitterApi);

describe('TwitterService', () => {
  let service: TwitterService;
  const mockConfig: TwitterServiceConfig = {
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    webhookPort: 3000,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    service = new TwitterService(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with API key/secret', () => {
      const service = new TwitterService(mockConfig);
      expect(service).toBeInstanceOf(TwitterService);
      expect(MockedTwitterApi).toHaveBeenCalledWith({
        appKey: mockConfig.apiKey,
        appSecret: mockConfig.apiSecret,
      });
    });

    it('should create instance with bearer token', () => {
      const configWithBearer = {
        ...mockConfig,
        bearerToken: 'test-bearer-token',
      };
      const service = new TwitterService(configWithBearer);
      expect(service).toBeInstanceOf(TwitterService);
      expect(MockedTwitterApi).toHaveBeenCalledWith(configWithBearer.bearerToken);
    });
  });

  describe('event handling', () => {
    it('should emit newMention event when valid mention is received', (done) => {
      const validMention = {
        tweet: {
          text: 'test mention',
          id: 'tweet-id',
          conversation_id: 'thread-id',
          author_id: 'user-id',
        },
      };

      service.on('newMention', (event: MentionEvent) => {
        expect(event).toEqual({
          message: validMention.tweet.text,
          threadId: validMention.tweet.conversation_id,
          userId: validMention.tweet.author_id,
          tweetId: validMention.tweet.id,
        });
        done();
      });

      // Simulate webhook call
      service['handleMention'](validMention);
    });

    it('should not emit newMention event for invalid mention', () => {
      const invalidMention = {
        not_a_tweet: {},
      };

      const mockEmit = jest.spyOn(service, 'emit');
      service['handleMention'](invalidMention);

      expect(mockEmit).not.toHaveBeenCalledWith('newMention', expect.any(Object));
    });
  });

  describe('thread context', () => {
    it('should maintain thread history', () => {
      const threadId = 'test-thread';
      const message = {
        senderId: 'user1',
        timestamp: Date.now(),
        content: 'test message',
      };

      service['addMessageToThread'](threadId, message);
      const context = service['getThreadContext'](threadId);

      expect(context.threadId).toBe(threadId);
      expect(context.history).toHaveLength(1);
      expect(context.history[0]).toEqual(message);
    });

    it('should respect thread history limit', () => {
      const configWithLimit = {
        ...mockConfig,
        threadHistoryLimit: 2,
      };
      const service = new TwitterService(configWithLimit);
      const threadId = 'test-thread';

      // Add three messages
      const messages = [
        { senderId: 'user1', timestamp: 1, content: 'message 1' },
        { senderId: 'user1', timestamp: 2, content: 'message 2' },
        { senderId: 'user1', timestamp: 3, content: 'message 3' },
      ];

      messages.forEach(msg => service['addMessageToThread'](threadId, msg));
      const context = service['getThreadContext'](threadId);

      expect(context.history).toHaveLength(2);
      expect(context.history).toEqual([messages[1], messages[2]]);
    });
  });

  describe('error handling', () => {
    it('should emit rateLimitWarning when rate limited', async () => {
      const tweetId = 'test-tweet';
      const message = 'test reply';
      const mockError = new Error('Rate limit exceeded');
      (mockError as any).rateLimitError = true;

      // Mock the reply method to throw rate limit error
      mockTwitterApiv2.reply.mockRejectedValueOnce(mockError);

      // Create a new service instance with the mocked implementation
      const serviceWithMock = new TwitterService(mockConfig);
      const mockEmit = jest.spyOn(serviceWithMock, 'emit');

      try {
        await serviceWithMock['replyToTweet'](tweetId, message);
      } catch (error) {
        expect(error).toBe(mockError);
      }

      expect(mockEmit).toHaveBeenCalledWith('rateLimitWarning', {
        tweetId,
        message,
        error: mockError,
      });
    });
  });
}); 