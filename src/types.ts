import { z } from 'zod';

/**
 * Configuration options for the Twitter service
 */
export interface TwitterServiceConfig {
  /** Twitter API Key */
  apiKey: string;
  /** Twitter API Secret */
  apiSecret: string;
  /** Port number for the webhook server */
  webhookPort: number;
  /** Optional bearer token for authentication */
  bearerToken?: string;
  /** Maximum number of messages to keep in thread history */
  threadHistoryLimit?: number;
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
 * Zod schema for validating Twitter webhook payloads
 */
export const twitterWebhookSchema = z.object({
  tweet: z.object({
    text: z.string(),
    id: z.string(),
    conversation_id: z.string(),
    author_id: z.string(),
  }).optional(),
  // Add other webhook payload validations as needed
}); 