import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi } from 'twitter-api-v2';
import express from 'express';
import { MockApp, MockServer, MockRequest, MockResponse } from '../__mocks__/express';
import { MockTwitterApiV2 } from '../__mocks__/twitter-api-v2';

jest.mock('express');
jest.mock('twitter-api-v2');

const MockedTwitterApi = jest.mocked(TwitterApi);
const MockedExpress = jest.mocked(express);

describe('TwitterService', () => {
  let service: TwitterService;
  let mockApp: MockApp;
  let mockServer: MockServer;
  let mockTwitterApiV2: MockTwitterApiV2;
  
  const mockConfig: TwitterServiceConfig = {
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    webhookPort: 3000,
    threadHistoryLimit: 50,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup express mocks
    mockServer = { on: jest.fn() } as MockServer;
    mockApp = {
      use: jest.fn(),
      post: jest.fn(),
      listen: jest.fn().mockImplementation((port: number, cb?: () => void) => {
        if (cb) cb();
        return mockServer;
      }),
    };
    (MockedExpress as any).mockReturnValue(mockApp);
    
    // Setup Twitter API mock
    mockTwitterApiV2 = {
      reply: jest.fn(),
      tweet: jest.fn(),
      userTimeline: jest.fn(),
      deleteTweet: jest.fn(),
      _prefix: '',
      readWrite: {},
      labs: {},
      readOnly: {},
    };
    MockedTwitterApi.mockImplementation(() => ({
      v2: mockTwitterApiV2,
    }));
    
    service = new TwitterService(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with API key/secret', () => {
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

    it('should use default thread history limit if not provided', async () => {
      const service = new TwitterService({
        ...mockConfig,
        threadHistoryLimit: undefined,
      });
      const threadId = 'test-thread';
      const messages = Array.from({ length: 51 }, (_, i) => ({
        senderId: 'user1',
        timestamp: i,
        content: `message ${i}`,
      }));

      // Add messages one by one to ensure they are processed in order
      for (const msg of messages) {
        service['addMessageToThread'](threadId, msg);
      }

      // Get the context after all messages are added
      const context = service['getThreadContext'](threadId);
      
      // Should keep the most recent 50 messages
      expect(context.history).toHaveLength(50);
      // Should have messages 1-50 (not 0-49)
      expect(context.history[0].content).toBe('message 1');
      expect(context.history[49].content).toBe('message 50');
      // Verify messages are in order
      const contents = context.history.map(msg => msg.content);
      expect(contents).toEqual(messages.slice(1).map(msg => msg.content));
    });
  });

  describe('server initialization', () => {
    let mockExpressApp: any;

    beforeEach(() => {
      // Reset express mock for each test
      jest.clearAllMocks();

      // Create a new mock server for each test
      mockServer = { on: jest.fn() };

      // Create a new mock app for each test
      mockExpressApp = {
        use: jest.fn(),
        post: jest.fn(),
        listen: jest.fn().mockImplementation((port: number, cb?: () => void) => {
          if (cb) cb();
          return mockServer;
        }),
      };

      // Setup the express mock
      (MockedExpress as any).mockReturnValue(mockExpressApp);
      (express.json as jest.Mock).mockReturnValue(jest.fn());

      // Create a new service instance
      service = new TwitterService(mockConfig);
    });

    it('should start server successfully', async () => {
      await service.start();
      expect(mockExpressApp.listen).toHaveBeenCalledWith(mockConfig.webhookPort, expect.any(Function));
    });

    it('should handle server startup error', async () => {
      const mockError = new Error('Server startup failed');
      mockServer.on.mockImplementation((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          handler(mockError);
        }
      });

      const mockEmit = jest.spyOn(service, 'emit');
      await service.start();

      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockEmit).toHaveBeenCalledWith('serverError', mockError);
    });

    it('should handle express middleware error', async () => {
      const mockError = new Error('Middleware error');
      (express.json as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      await expect(service.start()).rejects.toThrow(mockError);
    });

    it('should handle port already in use error', async () => {
      const mockError = new Error('EADDRINUSE');
      mockServer.on.mockImplementation((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          handler(mockError);
        }
      });

      const mockEmit = jest.spyOn(service, 'emit');
      await service.start();

      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockEmit).toHaveBeenCalledWith('serverError', mockError);
    });
  });

  describe('webhook handling', () => {
    it('should handle webhook processing error', async () => {
      const mockReq = {
        body: { invalid: 'data' },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await service['webhook'](mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
    });

    it('should process valid webhook data', async () => {
      const validMention = {
        tweet: {
          text: 'test mention',
          id: 'tweet-id',
          conversation_id: 'thread-id',
          author_id: 'user-id',
        },
      };

      const mockReq = {
        body: validMention,
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      const mockEmit = jest.spyOn(service, 'emit');

      await service['webhook'](mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
      expect(mockEmit).toHaveBeenCalledWith('newMention', expect.any(Object));
    });

    it('should handle malformed JSON in webhook request', async () => {
      const mockReq = {
        body: undefined,
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      const mockEmit = jest.spyOn(service, 'emit');

      await service['webhook'](mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
      expect(mockEmit).not.toHaveBeenCalledWith('newMention', expect.any(Object));
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

    it('should handle mentions with referenced tweets', () => {
      const mentionWithRefs = {
        tweet: {
          text: 'test mention',
          id: 'tweet-id',
          conversation_id: 'thread-id',
          author_id: 'user-id',
          referenced_tweets: [
            { type: 'replied_to', id: 'original-tweet' },
          ],
        },
      };

      const mockEmit = jest.spyOn(service, 'emit');
      service['handleMention'](mentionWithRefs);

      expect(mockEmit).toHaveBeenCalledWith('newMention', expect.any(Object));
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

    it('should handle concurrent thread updates', async () => {
      const service = new TwitterService({
        ...mockConfig,
        threadHistoryLimit: 50,
      });
      const threadId = 'test-thread';
      const messages = Array.from({ length: 100 }, (_, i) => ({
        senderId: 'user1',
        timestamp: i,
        content: `message ${i}`,
      }));

      // Simulate concurrent updates
      await Promise.all(messages.map(msg => 
        Promise.resolve().then(() => service['addMessageToThread'](threadId, msg))
      ));

      const context = service['getThreadContext'](threadId);
      
      // Should respect the default limit of 50
      expect(context.history).toHaveLength(50);
      
      // Verify messages are in chronological order
      const timestamps = context.history.map(msg => msg.timestamp);
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
      
      // Verify we have the last 50 messages
      expect(timestamps[0]).toBe(50); // Should start at message 50
      expect(timestamps[49]).toBe(99); // Should end at message 99
    });

    it('should handle multiple threads independently', () => {
      const thread1 = 'thread-1';
      const thread2 = 'thread-2';

      const message1 = { senderId: 'user1', timestamp: 1, content: 'thread 1 message' };
      const message2 = { senderId: 'user2', timestamp: 2, content: 'thread 2 message' };

      service['addMessageToThread'](thread1, message1);
      service['addMessageToThread'](thread2, message2);

      const context1 = service['getThreadContext'](thread1);
      const context2 = service['getThreadContext'](thread2);

      expect(context1.history[0]).toEqual(message1);
      expect(context2.history[0]).toEqual(message2);
    });
  });

  describe('error handling', () => {
    it('should emit rateLimitWarning when rate limited', async () => {
      const tweetId = 'test-tweet';
      const message = 'test reply';
      const mockError = new Error('Rate limit exceeded');
      (mockError as any).rateLimitError = true;

      mockTwitterApiV2.reply.mockRejectedValueOnce(mockError);

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

    it('should handle successful tweet reply', async () => {
      const tweetId = 'test-tweet';
      const message = 'test reply';
      const mockResponse = { data: { id: 'reply-id' } };

      mockTwitterApiV2.reply.mockResolvedValueOnce(mockResponse);

      const response = await service['replyToTweet'](tweetId, message);
      expect(response).toEqual(mockResponse);
      expect(mockTwitterApiV2.reply).toHaveBeenCalledWith(message, tweetId);
    });

    it('should emit tweetError for non-rate-limit errors', async () => {
      const tweetId = 'test-tweet';
      const message = 'test reply';
      const mockError = new Error('API error');

      mockTwitterApiV2.reply.mockRejectedValueOnce(mockError);

      const mockEmit = jest.spyOn(service, 'emit');

      try {
        await service['replyToTweet'](tweetId, message);
      } catch (error) {
        expect(error).toBe(mockError);
      }

      expect(mockEmit).toHaveBeenCalledWith('tweetError', {
        tweetId,
        message,
        error: mockError,
      });
    });

    it('should handle network errors during tweet reply', async () => {
      const tweetId = 'test-tweet';
      const message = 'test reply';
      const mockError = new Error('Network error');
      mockError.name = 'NetworkError';

      mockTwitterApiV2.reply.mockRejectedValueOnce(mockError);
      const mockEmit = jest.spyOn(service, 'emit');

      try {
        await service['replyToTweet'](tweetId, message);
      } catch (error) {
        expect(error).toBe(mockError);
      }

      expect(mockEmit).toHaveBeenCalledWith('tweetError', {
        tweetId,
        message,
        error: mockError,
      });
    });
  });
}); 