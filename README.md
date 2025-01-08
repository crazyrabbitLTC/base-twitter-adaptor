# base-twitter-adaptor

A base Twitter adapter for building LLM-powered Twitter bots. This package provides a clean, type-safe interface for interacting with the Twitter API, with built-in support for handling mentions, managing conversations, and rate limiting.

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

### Basic Twitter Service

```typescript
import { TwitterService, TwitterServiceConfig } from 'base-twitter-adaptor';

const config: TwitterServiceConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 60000 // Poll every minute
};

const twitterService = new TwitterService(config);

// Handle new mentions
twitterService.on('newMention', async (mentionEvent) => {
  console.log('New mention:', mentionEvent);
  // Handle the mention event
});

// Start the service
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
  pollIntervalMs: 10000
};

const llmToolAdapter = new LLMToolAdapter({ twitterConfig });

// Handle Twitter events
llmToolAdapter.on('newTwitterMessage', (response) => {
  console.log("New twitter message for LLM:", response);
  // Send to your LLM
});

llmToolAdapter.on('rateLimitWarning', (rateLimit) => {
  console.warn('Rate limit warning:', rateLimit);
});

// Start the adapter
await llmToolAdapter.start();

// Example LLM actions
const profile = await llmToolAdapter.getMyProfile();
const tweet = await llmToolAdapter.postTweet("Hello from the LLM!");
const search = await llmToolAdapter.searchTweets("ai");
const reply = await llmToolAdapter.replyToTweet(tweetId, "Thanks for the mention!");
```

## Features

- Polling for new mentions
- Event-based architecture for handling mentions
- Thread context management
- Rate limit handling
- Structured logging
- TypeScript support
- LLM-friendly adapter interface

## Types

### TwitterServiceConfig
```typescript
interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
  pollIntervalMs?: number;
  threadHistoryLimit?: number;
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