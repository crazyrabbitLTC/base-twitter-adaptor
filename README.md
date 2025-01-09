# base-twitter-adaptor

A type-safe Twitter API adapter with built-in LLM support for building AI-powered Twitter bots. This package provides a clean, type-safe interface for interacting with the Twitter API, with built-in support for handling mentions, managing conversations, and rate limiting.

## Installation

```bash
npm install base-twitter-adaptor
# or
yarn add base-twitter-adaptor
```

## Configuration

Create a `.env` file with your Twitter API credentials:

```env
# X (Twitter) API Credentials
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_BEARER_TOKEN=your_bearer_token
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret
```

## Usage

### Basic Twitter Service with Polling

```typescript
import { TwitterService, TwitterServiceConfig } from 'base-twitter-adaptor';

const config: TwitterServiceConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 60000, // Poll every minute
  threadHistoryLimit: 50, // Keep last 50 messages in thread history
  includeOwnTweets: true, // Include tweets from the authenticated user
  logLevel: 'info', // Set logging level
  sinceId: '1234567890', // Optional: Start polling from a specific tweet
};

const twitterService = new TwitterService(config);

// Handle new mentions from polling
twitterService.on('newMention', async mentionEvent => {
  console.log('New mention:', mentionEvent);
  // Handle the mention event
  await twitterService.replyToTweet(mentionEvent.tweetId, 'Thanks for the mention!');
});

// Handle rate limits
twitterService.on('rateLimitWarning', warning => {
  console.warn('Rate limit warning:', warning);
});

// Handle polling errors
twitterService.on('pollError', error => {
  console.error('Error during polling:', error);
});

// Start the service (begins polling)
await twitterService.start();
```

### LLM Tool Adapter

```typescript
import { LLMToolAdapter } from 'base-twitter-adaptor';

const twitterConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 10000, // Poll every 10 seconds
  includeOwnTweets: true,
  logLevel: 'info',
};

const llmToolAdapter = new LLMToolAdapter({ twitterConfig });

// Handle Twitter events from polling
llmToolAdapter.on('newTwitterMessage', response => {
  console.log('New twitter message for LLM:', response);
  // Send to your LLM
  // response.data contains:
  // - messageId: string (tweet ID)
  // - threadId: string (conversation ID)
  // - userId: string (author ID)
  // - content: string (tweet text)
});

// Handle rate limit warnings
llmToolAdapter.on('rateLimitWarning', rateLimit => {
  console.warn('Rate limit warning:', rateLimit);
  // rateLimit contains:
  // - error: any (rate limit error details)
  // - message: string (error message)
});

// Handle general errors
llmToolAdapter.on('error', error => {
  console.error('Error:', error);
  // error contains:
  // - success: false
  // - error: any (error details)
  // - message: string (error description)
});

// Start the adapter (begins polling)
const startResult = await llmToolAdapter.start();
if (!startResult.success) {
  console.error('Failed to start adapter:', startResult.error);
  return;
}

// Example LLM actions with error handling
try {
  // Get user profile
  const profileResponse = await llmToolAdapter.getMyProfile();
  if (!profileResponse.success) {
    console.error('Failed to get profile:', profileResponse.error);
    return;
  }
  const profile = profileResponse.data;

  // Post a tweet
  const tweetResponse = await llmToolAdapter.postTweet('Hello from the LLM!');
  if (!tweetResponse.success) {
    console.error('Failed to post tweet:', tweetResponse.error);
    return;
  }
  const tweet = tweetResponse.data;

  // Search tweets
  const searchResponse = await llmToolAdapter.searchTweets('ai');
  if (!searchResponse.success) {
    console.error('Failed to search tweets:', searchResponse.error);
    return;
  }
  const searchResults = searchResponse.data;

  // Reply to a tweet
  const replyResponse = await llmToolAdapter.replyToTweet(tweet.id, 'Thanks for the mention!');
  if (!replyResponse.success) {
    console.error('Failed to reply:', replyResponse.error);
    return;
  }
  const reply = replyResponse.data;
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Features

- **Automated Mention Polling**: Configurable polling interval for monitoring mentions
- **Thread Context Management**: Maintains conversation history with configurable limits
- **Event-based Architecture**: Real-time events for mentions, rate limits, and errors
- **Rate Limit Handling**: Built-in rate limit detection and warning events
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **LLM Integration**: Purpose-built adapter for LLM interactions
- **Structured Logging**: Detailed logging with timestamps and metadata
- **Error Handling**: Comprehensive error handling and event emission

## Types

### TwitterServiceConfig

```typescript
interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
  pollIntervalMs?: number; // Default: 60000 (1 minute)
  threadHistoryLimit?: number; // Default: 50 messages
  sinceId?: string; // Start polling from a specific tweet ID
  skipInitialPoll?: boolean; // Skip the first poll on startup
  includeOwnTweets?: boolean; // Include tweets from the authenticated user
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'silent'; // Default: 'info'
}
```

### MentionEvent

```typescript
interface MentionEvent {
  threadId: string;
  userId: string;
  message: string;
  tweetId: string;
}
```

### LLMResponse

```typescript
interface LLMResponse {
  success: boolean;
  message?: string;
  error?: any;
  data?: any;
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
