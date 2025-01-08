import { tweetSchema } from '../types';

describe('Tweet Schema', () => {
  it('should validate a valid tweet', () => {
    const validTweet = {
      text: 'Hello, world!',
      id: '123456789',
      conversation_id: 'conv123',
      author_id: 'user123',
      created_at: '2024-01-07T12:00:00Z',
      in_reply_to_user_id: 'user456',
    };

    const result = tweetSchema.safeParse(validTweet);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validTweet);
      expect(result.data.text).toBe('Hello, world!');
      expect(result.data.author_id).toBe('user123');
    }
  });

  it('should validate a tweet with optional fields', () => {
    const tweetWithOptionals = {
      text: 'Hello, world!',
      id: '123456789',
      conversation_id: 'conv123',
      author_id: 'user123',
      referenced_tweets: [
        { type: 'replied_to', id: '987654321' },
      ],
      entities: {
        mentions: [{ username: 'test', id: 'user456' }],
      },
    };

    const result = tweetSchema.safeParse(tweetWithOptionals);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referenced_tweets).toBeDefined();
      expect(result.data.entities?.mentions).toBeDefined();
    }
  });

  it('should reject invalid tweets', () => {
    const invalidTweet = {
      text: 123, // Should be string
      id: '123456789',
      conversation_id: 'conv123',
      author_id: 'user123',
    };

    const result = tweetSchema.safeParse(invalidTweet);
    expect(result.success).toBe(false);
  });

  it('should validate tweet with edit history', () => {
    const tweetWithEditHistory = {
      text: 'Hello, world!',
      id: '123456789',
      conversation_id: 'conv123',
      author_id: 'user123',
      edit_history_tweet_ids: ['123456789', '987654321'],
    };

    const result = tweetSchema.safeParse(tweetWithEditHistory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.edit_history_tweet_ids).toHaveLength(2);
    }
  });
}); 