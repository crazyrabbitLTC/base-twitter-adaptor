import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi } from 'twitter-api-v2';
import express from 'express';
import { MockApp, MockServer, MockRequest, MockResponse } from '../__mocks__/express';
import { MockTwitterApiV2 } from '../__mocks__/twitter-api-v2';
import mockExpress from '../__mocks__/express';

jest.mock('express');
jest.mock('twitter-api-v2');
jest.mock('winston');

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
    threadHistoryLimit: 50,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup Twitter API mock with full interface implementation
    mockTwitterApiV2 = {
      reply: jest.fn(),
      tweet: jest.fn(),
      userTimeline: jest.fn(),
      deleteTweet: jest.fn(),
      _prefix: '',
      readWrite: {},
      labs: {},
      readOnly: {},
      get: jest.fn().mockImplementation((endpoint: string) => {
        if (endpoint === 'users/me') {
          return Promise.resolve({
            data: {
              id: 'test-user-id',
              username: 'test-username',
            },
          });
        }
        return Promise.reject(new Error(`Unhandled endpoint: ${endpoint}`));
      }),
      search: jest.fn(),
    };

    const mockTwitterApi = {
      v2: mockTwitterApiV2,
      readWrite: {},
      readOnly: {},
    } as unknown as TwitterApi;

    MockedTwitterApi.mockImplementation(() => mockTwitterApi);

    service = new TwitterService(mockConfig);
  });

  describe('event handling', () => {
    it('should emit newMention event when valid mention is received', done => {
      const validMention = {
        tweet: {
          text: 'Test mention',
          id: 'test-tweet-id',
          conversation_id: 'test-conversation-id',
          author_id: 'test-author-id',
          edit_history_tweet_ids: ['test-tweet-id'],
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
      } as any;

      const mockEmit = jest.spyOn(service, 'emit');
      service['handleMention'](invalidMention);

      expect(mockEmit).not.toHaveBeenCalledWith('newMention', expect.any(Object));
    });

    it('should handle mentions with referenced tweets', () => {
      const mentionWithRefs = {
        tweet: {
          text: 'Test mention',
          id: 'test-tweet-id',
          conversation_id: 'test-conversation-id',
          author_id: 'test-author-id',
          referenced_tweets: [{ type: 'replied_to' as const, id: 'test-ref-id' }],
          edit_history_tweet_ids: ['test-tweet-id'],
        },
      };

      const mockEmit = jest.spyOn(service, 'emit');
      service['handleMention'](mentionWithRefs);

      expect(mockEmit).toHaveBeenCalledWith('newMention', expect.any(Object));
    });
  });
});
