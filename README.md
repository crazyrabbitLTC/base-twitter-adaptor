# Twitter Service

A TypeScript service for interacting with the Twitter API, focusing on handling mentions and managing conversations.

## Installation

```bash
npm install
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

# Test Control
RUN_LIVE_TESTS=false
```

## Usage

```typescript
import { TwitterService, TwitterServiceConfig } from './src';

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
  // mentionEvent contains:
  // - threadId: string
  // - userId: string
  // - message: string
  // - tweetId: string
});

// Start the service
await twitterService.start();
```

## Features

- Polling for new mentions
- Event-based architecture for handling mentions
- Thread context management
- Rate limit handling
- Structured logging
- TypeScript support

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

### Message
```typescript
interface Message {
  senderId: string;
  timestamp: number;
  content: string;
}
```

### ThreadContext
```typescript
interface ThreadContext {
  threadId: string;
  history: Message[];
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

## License

ISC 