import { LLMToolAdapter } from '../LLMToolAdapter';
import { TwitterServiceConfig } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const twitterConfig: TwitterServiceConfig = {
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  pollIntervalMs: 10000, // Poll every 10 seconds
};

const llmToolAdapter = new LLMToolAdapter({ twitterConfig });

llmToolAdapter.on('newTwitterMessage', response => {
  console.log('New twitter message for LLM:', response);
  // Send to your LLM
});

llmToolAdapter.on('rateLimitWarning', rateLimit => {
  console.warn('Rate limit warning:', rateLimit);
  // Handle rate limit
});

llmToolAdapter.on('pollError', error => {
  console.error('Poll Error:', error);
  // Handle poll error
});

llmToolAdapter.on('tweetError', error => {
  console.error('Tweet Error:', error);
  // Handle tweet error
});

async function main() {
  await llmToolAdapter.start();

  try {
    // Example of sending LLM commands:
    const profile = await llmToolAdapter.getMyProfile();
    console.log('My profile:', profile);

    const post = await llmToolAdapter.postTweet('Hello from the LLM');
    console.log('Post response:', post);

    const search = await llmToolAdapter.searchTweets('test');
    console.log('Search response:', search);

    // To reply the LLM needs to provide the tweet id:
    if (search.success && search.data.data && search.data.data[0]?.id) {
      const reply = await llmToolAdapter.replyToTweet(search.data.data[0].id, 'This is a test reply');
      console.log('Reply Response:', reply);
    }
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Stopping LLM Tool Adapter...');
  await llmToolAdapter.stop();
  process.exit(0);
});

main();
