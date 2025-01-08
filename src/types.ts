import { z } from 'zod';

/**
 * Configuration options for the Twitter service
 */
export interface TwitterServiceConfig {
  /** Twitter API Key */
  apiKey: string;
  /** Twitter API Secret */
  apiSecret: string;
  /** Optional bearer token for authentication */
  bearerToken?: string;
  /** Optional access token for user-specific actions */
  accessToken?: string;
  /** Optional access token secret for user-specific actions */
  accessTokenSecret?: string;
  /** Maximum number of messages to keep in thread history */
  threadHistoryLimit?: number;
  /** Interval in milliseconds between polling for mentions */
  pollIntervalMs?: number;
  /** Port number for the webhook server */
  webhookPort?: number;
}

/**
 * Event emitted when a new mention is received
 */
export interface MentionEvent {
  /** ID of the conversation thread */
  threadId: string;
  /** ID of the user who created the mention */
  userId: string;
  /** Content of the mention */
  message: string;
  /** ID of the tweet */
  tweetId: string;
}

/**
 * Represents a message in a thread
 */
export interface Message {
  /** ID of the user who sent the message */
  senderId: string;
  /** Unix timestamp of when the message was sent */
  timestamp: number;
  /** Content of the message */
  content: string;
}

/**
 * Context for a conversation thread
 */
export interface ThreadContext {
  /** ID of the thread */
  threadId: string;
  /** History of messages in the thread */
  history: Message[];
}

/**
 * Rate limit error event
 */
export interface RateLimitEvent {
  /** ID of the tweet that triggered the rate limit */
  tweetId: string;
  /** Message that was attempted to be sent */
  message: string;
  /** Error details from Twitter API */
  error: any;
}

/**
 * Twitter entity mention
 */
const twitterMentionSchema = z.object({
  username: z.string(),
  id: z.string(),
});

/**
 * Twitter entities object
 */
const twitterEntitiesSchema = z.object({
  mentions: z.array(twitterMentionSchema).optional(),
});

/**
 * Referenced tweet object
 */
const referencedTweetSchema = z.object({
  type: z.string(),
  id: z.string(),
});

/**
 * Tweet object schema
 */
const tweetSchema = z.object({
  text: z.string(),
  id: z.string(),
  conversation_id: z.string(),
  author_id: z.string(),
  created_at: z.string().optional(),
  in_reply_to_user_id: z.string().optional(),
  referenced_tweets: z.array(referencedTweetSchema).optional(),
  entities: twitterEntitiesSchema.optional(),
});

/**
 * Direct message data schema
 */
const directMessageDataSchema = z.object({
  text: z.string(),
  entities: z.record(z.any()).optional(),
});

/**
 * Direct message create schema
 */
const directMessageCreateSchema = z.object({
  message_data: directMessageDataSchema,
  sender_id: z.string(),
  target: z.object({
    recipient_id: z.string(),
  }).optional(),
});

/**
 * Direct message event schema
 */
const directMessageEventSchema = z.object({
  type: z.string(),
  id: z.string(),
  message_create: directMessageCreateSchema,
});

/**
 * Zod schema for validating Twitter webhook payloads
 */
export const twitterWebhookSchema = z.object({
  tweet: tweetSchema.optional(),
  direct_message_events: z.array(directMessageEventSchema).optional(),
}); 