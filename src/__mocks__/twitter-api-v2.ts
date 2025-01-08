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
}

export interface MockTwitterApi {
  v2: MockTwitterApiV2;
}

// Create mock Twitter API v2 instance
const createMockTwitterApiV2 = (): MockTwitterApiV2 => ({
  reply: jest.fn(),
  tweet: jest.fn(),
  userTimeline: jest.fn(),
  deleteTweet: jest.fn(),
  _prefix: '',
  readWrite: {},
  labs: {},
  readOnly: {},
});

// Create mock Twitter API factory
const createMockTwitterApi = (): jest.MockedClass<typeof RealTwitterApi> => {
  const mockTwitterApiV2 = createMockTwitterApiV2();
  
  return jest.fn().mockImplementation(() => ({
    v2: mockTwitterApiV2,
  })) as jest.MockedClass<typeof RealTwitterApi>;
};

export const TwitterApi = createMockTwitterApi(); 