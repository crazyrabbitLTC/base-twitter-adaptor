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
};

const llmToolAdapter = new LLMToolAdapter({ twitterConfig });

// Handle Twitter events from polling
llmToolAdapter.on('newTwitterMessage', response => {
  console.log('New twitter message for LLM:', response);
  // Send to your LLM
});

llmToolAdapter.on('rateLimitWarning', rateLimit => {
  console.warn('Rate limit warning:', rateLimit);
});

// Start the adapter (begins polling)
await llmToolAdapter.start();

// Example LLM actions
const profile = await llmToolAdapter.getMyProfile();
const tweet = await llmToolAdapter.postTweet('Hello from the LLM!');
const search = await llmToolAdapter.searchTweets('ai');
const reply = await llmToolAdapter.replyToTweet(tweetId, 'Thanks for the mention!');
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
