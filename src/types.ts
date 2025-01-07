export interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  webhookPort: number;
  bearerToken?: string;
}

export interface MentionEvent {
  threadId: string;
  userId: string;
  message: string;
  tweetId: string;
}

export interface Message {
  senderId: string;
  timestamp: number;
  content: string;
}

export interface ThreadContext {
  threadId: string;
  history: Message[];
} 