import { z } from 'zod';

/**
 * Configuration for the Twitter service
 */
export interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
  pollIntervalMs?: number;
  threadHistoryLimit?: number;
}

/**
 * Event emitted when a new mention is received
 */
export interface MentionEvent {
  threadId: string;
  userId: string;
  message: string;
  tweetId: string;
}

/**
 * Message in a thread's history
 */
export interface Message {
  senderId: string;
  timestamp: number;
  content: string;
}

/**
 * Context for a thread, including its history
 */
export interface ThreadContext {
  threadId: string;
  history: Message[];
}

/**
 * Tweet schema for validation
 */
export const tweetSchema = z.object({
  text: z.string(),
  id: z.string(),
  conversation_id: z.string(),
  author_id: z.string(),
  created_at: z.string().optional(),
  in_reply_to_user_id: z.string().optional(),
  referenced_tweets: z.array(
    z.object({
      type: z.enum(['replied_to', 'quoted', 'retweeted']),
      id: z.string(),
    })
  ).optional(),
  entities: z.object({
    mentions: z.array(
      z.object({
        username: z.string(),
        id: z.string(),
      })
    ).optional(),
  }).optional(),
  edit_history_tweet_ids: z.array(z.string()).optional(),
}); 