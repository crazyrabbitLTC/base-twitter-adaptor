import { twitterWebhookSchema } from '../types';

describe('Twitter Webhook Schema', () => {
  it('should validate a valid webhook payload', () => {
    const validPayload = {
      tweet: {
        text: 'Hello, world!',
        id: '123456789',
        conversation_id: 'conv123',
        author_id: 'user123',
      },
    };

    const result = twitterWebhookSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPayload);
    }
  });

  it('should validate payload without tweet object', () => {
    const payloadWithoutTweet = {};
    const result = twitterWebhookSchema.safeParse(payloadWithoutTweet);
    expect(result.success).toBe(true);
  });

  it('should fail validation for invalid tweet object', () => {
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
}); 