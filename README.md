# @dao-bot/twitter-service

A Twitter service for DAO Bot that handles Twitter API interactions, webhook processing, and thread context management.

## Installation

```bash
npm install @dao-bot/twitter-service
```

## Setup

1. Create a Twitter Developer Account and set up a Project
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Create a new Project and App
   - Get your API Key and API Secret
   - Set up OAuth 2.0 credentials
   - (Optional) Generate a Bearer Token

2. Configure your environment
   - Set up a webhook endpoint that's publicly accessible
   - Ensure your server can receive POST requests at your webhook URL

## Usage

```typescript
import { TwitterService } from '@dao-bot/twitter-service';

// Initialize the service
const twitterService = new TwitterService({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  webhookPort: 3000,
  // Optional: bearerToken: 'your_bearer_token'
});

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

- Webhook endpoint for receiving Twitter events
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
  webhookPort: number;
  bearerToken?: string;
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

# Start in development mode
npm run dev

# Build and start
npm start
```

## License

ISC 