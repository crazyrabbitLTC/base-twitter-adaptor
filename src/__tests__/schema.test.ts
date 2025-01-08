import { twitterWebhookSchema } from '../types';

describe('Twitter Webhook Schema', () => {
  describe('tweet events', () => {
    it('should validate a valid tweet webhook payload', () => {
      const validPayload = {
        tweet: {
          text: 'Hello, world!',
          id: '123456789',
          conversation_id: 'conv123',
          author_id: 'user123',
          created_at: '2024-01-07T12:00:00Z',
          in_reply_to_user_id: 'user456',
        },
      };

      const result = twitterWebhookSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validPayload);
        expect(result.data.tweet?.text).toBe('Hello, world!');
        expect(result.data.tweet?.author_id).toBe('user123');
      }
    });

    it('should validate a tweet with optional fields', () => {
      const tweetWithOptionals = {
        tweet: {
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
        },
      };

      const result = twitterWebhookSchema.safeParse(tweetWithOptionals);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tweet?.referenced_tweets).toBeDefined();
        expect(result.data.tweet?.entities?.mentions).toBeDefined();
      }
    });

    it('should validate a tweet with multiple referenced tweets', () => {
      const tweetWithMultipleRefs = {
        tweet: {
          text: 'Hello, world!',
          id: '123456789',
          conversation_id: 'conv123',
          author_id: 'user123',
          referenced_tweets: [
            { type: 'replied_to', id: '987654321' },
            { type: 'quoted', id: '456789123' },
          ],
        },
      };

      const result = twitterWebhookSchema.safeParse(tweetWithMultipleRefs);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tweet?.referenced_tweets).toHaveLength(2);
      }
    });
  });

  describe('direct message events', () => {
    it('should validate a valid direct message event payload', () => {
      const validDirectMessagePayload = {
        direct_message_events: [{
          type: 'message_create',
          id: '123456789',
          message_create: {
            message_data: {
              text: 'Hello via DM',
              entities: {},
            },
            sender_id: 'sender123',
            target: {
              recipient_id: 'recipient456',
            },
          },
        }],
      };

      const result = twitterWebhookSchema.safeParse(validDirectMessagePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validDirectMessagePayload);
      }
    });

    it('should validate multiple direct message events', () => {
      const multipleDirectMessages = {
        direct_message_events: [
          {
            type: 'message_create',
            id: '123456789',
            message_create: {
              message_data: {
                text: 'First message',
                entities: {},
              },
              sender_id: 'sender123',
            },
          },
          {
            type: 'message_create',
            id: '987654321',
            message_create: {
              message_data: {
                text: 'Second message',
                entities: {},
              },
              sender_id: 'sender456',
            },
          },
        ],
      };

      const result = twitterWebhookSchema.safeParse(multipleDirectMessages);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.direct_message_events).toHaveLength(2);
      }
    });
  });

  describe('combined events', () => {
    it('should validate payload with both tweet and direct message events', () => {
      const combinedPayload = {
        tweet: {
          text: 'Hello, world!',
          id: '123456789',
          conversation_id: 'conv123',
          author_id: 'user123',
        },
        direct_message_events: [{
          type: 'message_create',
          id: '987654321',
          message_create: {
            message_data: {
              text: 'Hello via DM',
              entities: {},
            },
            sender_id: 'sender123',
          },
        }],
      };

      const result = twitterWebhookSchema.safeParse(combinedPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tweet).toBeDefined();
        expect(result.data.direct_message_events).toBeDefined();
      }
    });
  });

  describe('empty and missing fields', () => {
    it('should validate payload without any event object', () => {
      const emptyPayload = {};
      const result = twitterWebhookSchema.safeParse(emptyPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(emptyPayload);
      }
    });

    it('should validate payload with empty tweet object', () => {
      const emptyTweetPayload = {
        tweet: {
          text: '',
          id: '123456789',
          conversation_id: 'conv123',
          author_id: 'user123',
        },
      };

      const result = twitterWebhookSchema.safeParse(emptyTweetPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tweet?.text).toBe('');
      }
    });

    it('should validate payload with empty direct message events array', () => {
      const emptyDMPayload = {
        direct_message_events: [],
      };

      const result = twitterWebhookSchema.safeParse(emptyDMPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.direct_message_events).toHaveLength(0);
      }
    });
  });

  describe('validation failures', () => {
    it('should fail validation for invalid tweet object structure', () => {
      const invalidPayload = {
        tweet: {
          // Missing required fields
          text: 'Hello, world!',
        },
      };

      const result = twitterWebhookSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(3); // Should have 3 missing field errors
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('should fail validation for invalid field types', () => {
      const invalidTypes = {
        tweet: {
          text: 123, // Should be string
          id: 456, // Should be string
          conversation_id: true, // Should be string
          author_id: {}, // Should be string
        },
      };

      const result = twitterWebhookSchema.safeParse(invalidTypes);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(4); // Should have 4 type errors
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('should fail validation for invalid direct message structure', () => {
      const invalidDM = {
        direct_message_events: [{
          type: 'message_create',
          // Missing required fields
          message_create: {
            message_data: {
              // Missing text
            },
          },
        }],
      };

      const result = twitterWebhookSchema.safeParse(invalidDM);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should fail validation for invalid entities in tweet', () => {
      const invalidEntities = {
        tweet: {
          text: 'Hello',
          id: '123',
          conversation_id: 'conv123',
          author_id: 'user123',
          entities: {
            mentions: [
              { username: 123, id: true }, // Invalid types
            ],
          },
        },
      };

      const result = twitterWebhookSchema.safeParse(invalidEntities);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
}); 