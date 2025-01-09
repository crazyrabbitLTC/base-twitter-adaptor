import { TwitterApi as RealTwitterApi } from 'twitter-api-v2';

export interface MockTwitterApiV2 {
  reply: jest.Mock;
  tweet: jest.Mock;
  userTimeline: jest.Mock;
  deleteTweet: jest.Mock;
  _prefix: string;
  readWrite: Record<string, unknown>;
  labs: Record<string, unknown>;
  readOnly: Record<string, unknown>;
  get: jest.Mock<Promise<{ data: { id: string; username: string } }>>;
  search: jest.Mock;
}

export interface MockTwitterApi {
  v2: MockTwitterApiV2;
  readWrite: Record<string, unknown>;
  readOnly: Record<string, unknown>;
}

// Create mock Twitter API v2 instance
const createMockTwitterApiV2 = (): MockTwitterApiV2 => ({
  reply: jest.fn(),
  tweet: jest.fn().mockImplementation((text: string | { text: string }) => {
    const tweetText = typeof text === 'string' ? text : text.text;
    return Promise.resolve({
      data: {
        id: 'test-tweet-id',
        text: tweetText,
        edit_history_tweet_ids: ['test-tweet-id'],
      },
    });
  }),
  userTimeline: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      tweets: [
        {
          id: 'test-reply-id',
          text: 'Test reply',
          referenced_tweets: [
            {
              type: 'replied_to',
              id: 'test-tweet-id',
            },
          ],
        },
      ],
    });
  }),
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
  search: jest.fn().mockImplementation((query: string, params: any) => {
    return Promise.resolve({
      data: [
        {
          id: 'test-tweet-id',
          text: query,
          conversation_id: 'test-conversation-id',
          author_id: 'test-author-id',
          created_at: new Date().toISOString(),
          edit_history_tweet_ids: ['test-tweet-id'],
        },
      ],
    });
  }),
});

// Create mock Twitter API factory
const createMockTwitterApi = () => {
  const mockTwitterApiV2 = createMockTwitterApiV2();
  const MockTwitterApi = jest.fn().mockImplementation(() => ({
    v2: mockTwitterApiV2,
    readWrite: {},
    readOnly: {},
    getErrors: jest.fn(),
    getProfileImageInSize: jest.fn(),
  }));

  return MockTwitterApi as unknown as jest.MockedClass<typeof RealTwitterApi>;
};

export const TwitterApi = createMockTwitterApi();
