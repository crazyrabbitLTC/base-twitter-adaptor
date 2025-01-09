# base-twitter-adaptor

A type-safe Twitter API adapter with built-in LLM support for building AI-powered Twitter bots. This package provides a clean, type-safe interface for interacting with the Twitter API, with built-in support for handling mentions, managing conversations, and rate limiting.

## Installation

```bash
npm install base-twitter-adaptor
# or
yarn add base-twitter-adaptor
content_copy
download
Use code with caution.
Markdown
Configuration

Create a .env file with your Twitter API credentials:

# X (Twitter) API Credentials
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret
X_BEARER_TOKEN=your_bearer_token
content_copy
download
Use code with caution.
Env
Architecture

This library uses an event-driven architecture based on Node.js's EventEmitter. Both the TwitterService and LLMToolAdapter emit events that you can listen to for asynchronous communication. This approach allows for:

Real-time handling of mentions and responses

Decoupled error handling

Efficient rate limit management

Scalable message processing

Usage
Basic Twitter Service with Polling
import { TwitterService, TwitterServiceConfig } from 'base-twitter-adaptor';

const config: TwitterServiceConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 60000, // Poll every minute (default)
  threadHistoryLimit: 50, // Keep last 50 messages in thread history (default)
  logLevel: 'info', // Set logging level (default)
  sinceId: '0', // Optional: If not set or set to '0', it will use the last mention ID on subsequent runs.
};

const twitterService = new TwitterService(config);

// Handle new mentions from polling
twitterService.on('mention', async mentionEvent => {
  console.log('New mention:', mentionEvent);
  // Handle the mention event
  await twitterService.replyToTweet(mentionEvent.tweetId, 'Thanks for the mention!');
});

// Handle rate limits
twitterService.on('rateLimitWarning', warning => {
  // warning contains: { tweetId: string, message: string, error: Error }
  // Note: tweetId may be empty string when rate limit occurs during polling
  console.warn('Rate limit warning:', warning);
});

// Handle polling errors
twitterService.on('pollError', error => {
  console.error('Error during polling:', error);
});

// Handle tweet errors
twitterService.on('tweetError', error => {
  console.error('Error processing tweet:', error);
});

// Start the service (begins polling)
await twitterService.start();
content_copy
download
Use code with caution.
TypeScript
LLM Tool Adapter

The LLMToolAdapter provides a higher-level interface specifically designed for LLM interactions. For a complete example, see examples/llmToolExample.ts in the repository.

import { LLMToolAdapter } from 'base-twitter-adaptor';

const twitterConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 60000, // Default: 60000 (1 minute)
  threadHistoryLimit: 50, // Default: 50
  logLevel: 'info', // Default: 'info'
};

const llmTool = new LLMToolAdapter({ twitterConfig });

// Handle new twitter messages from polling
llmTool.on('newTwitterMessage', response => {
  console.log('New twitter message for LLM:', response);
  // Send to your LLM
  // response.data contains:
  // - messageId: string (tweet ID)
  // - threadId: string (conversation ID)
  // - userId: string (author ID)
  // - content: string (tweet text)
});

// Handle rate limits
llmTool.on('rateLimitWarning', warning => {
  console.warn('Rate limit warning:', warning);
  // warning contains: { error: Error, message: string }
  // Note: tweetId may be empty string when rate limit occurs during polling
});

// Handle errors
llmTool.on('error', error => {
  console.error('Error:', error);
    // error contains: { success: boolean, error: Error, message: string}
});

// Start the service
llmTool.start();

// Example LLM actions
try {
  // Get user profile
  const profile = await llmTool.getMyProfile();

  // Post a tweet
  const tweet = await llmTool.tweet('Hello from the LLM!');

  // Search tweets
  const searchResults = await llmTool.searchTweets('ai');

  // Reply to a tweet
  await llmTool.replyToTweet(tweet.id, 'This is a reply!');

    // Access the raw Twitter API client for deleteTweet
    const client = llmTool.getTwitterClient();
    await client.v2.deleteTweet(tweet.id);
    //Or
   // await llmTool.deleteTweet(tweet.id)
} catch (error) {
  console.error('Unexpected error:', error);
}
content_copy
download
Use code with caution.
TypeScript
Features

Automated Mention Polling: Configurable polling interval for monitoring mentions

Thread Context Management: Maintains conversation history with configurable limits

Event-driven Architecture: Real-time events for mentions, rate limits, and errors

Rate Limit Handling: Built-in rate limit detection and warning events

Type Safety: Full TypeScript support with comprehensive type definitions

LLM Integration: Purpose-built adapter for LLM interactions

Structured Logging: Detailed logging with timestamps and metadata

Error Handling: Comprehensive error handling and event emission

API Documentation
TwitterService

The core service that handles Twitter API interactions.

Methods

start(): Starts the polling service

stop(): Stops the polling service

replyToTweet(tweetId: string, text: string): Replies to a specific tweet

tweet(text: string): Posts a new tweet

getTwitterClient(): returns the underlying TwitterApi instance.

Events

mention: Emitted when a new mention is detected

rateLimitWarning: Emitted when hitting rate limits

pollError: Emitted when an error occurs during polling

tweetError: Emitted when an error occurs processing a tweet

LLMToolAdapter

Higher-level adapter designed for LLM interactions.

Methods

start(): Starts the service

getMyProfile(): Gets the authenticated user's profile

tweet(text: string): Posts a new tweet

replyToTweet(tweetId: string, text: string): Replies to a tweet

searchTweets(query: string): Searches for tweets

getTwitterClient(): Returns the underlying TwitterApi instance.

deleteTweet(tweetId: string): Deletes a tweet

Events

newTwitterMessage: Emitted when a new mention is detected. Contains: { success: boolean, data: { messageId: string, threadId: string, userId: string, content: string } }

rateLimitWarning: Emitted when hitting rate limits. Contains: { success: boolean, error: Error, message: string }

error: Emitted when a general error occurs. Contains: { success: boolean, error: Error, message: string}

Raw API Access

Note that methods that are not directly provided on the TwitterService or LLMToolAdapter, such as deleteTweet, can be accessed by using the raw TwitterApi client. Both TwitterService and LLMToolAdapter have a getTwitterClient() method that provides access to the underlying Twitter API client. This client exposes the entire twitter-api-v2 interface, allowing for a high degree of customization.

Types
TwitterServiceConfig
interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string; // Optional: Used as fallback if access token is not provided
  pollIntervalMs?: number; // Default: 60000 (1 minute)
  threadHistoryLimit?: number; // Default: 50 messages
   sinceId?: string; // Optional: If not set or set to '0', it will use the last mention ID on subsequent runs.
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'silent'; // Default: 'info'
}
content_copy
download
Use code with caution.
TypeScript
MentionEvent
interface MentionEvent {
  threadId: string;
  userId: string;
  message: string;
  tweetId: string;
}
content_copy
download
Use code with caution.
TypeScript
RateLimitEvent
interface RateLimitEvent {
  tweetId: string; // May be empty string during polling
  message: string;
  error: Error;
}
content_copy
download
Use code with caution.
TypeScript
Development
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
content_copy
download
Use code with caution.
Bash
Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

License

MIT

