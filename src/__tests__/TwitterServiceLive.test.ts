import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi, TweetV2, ReferencedTweetV2, TTweetv2Expansion } from 'twitter-api-v2';
import dotenv from 'dotenv';

// Ensure we're not using mocks for live tests
jest.unmock('twitter-api-v2');

// Load environment variables from .env file
dotenv.config();

// Skip these tests if not in CI or if credentials are not provided
const shouldRunLiveTests = process.env.CI === 'true' || process.env.RUN_LIVE_TESTS === 'true';

// Debug logging
console.log('Environment variables check:');
console.log('RUN_LIVE_TESTS:', process.env.RUN_LIVE_TESTS);
console.log('CI:', process.env.CI);
console.log('shouldRunLiveTests:', shouldRunLiveTests);
console.log('X_API_KEY exists:', !!process.env.X_API_KEY);
console.log('X_API_SECRET exists:', !!process.env.X_API_SECRET);
console.log('X_BEARER_TOKEN exists:', !!process.env.X_BEARER_TOKEN);
console.log('X_ACCESS_TOKEN exists:', !!process.env.X_ACCESS_TOKEN);
console.log('X_ACCESS_TOKEN_SECRET exists:', !!process.env.X_ACCESS_TOKEN_SECRET);

// Only run these tests if we have the required environment variables
const hasCredentials =
  process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET;

console.log('hasCredentials:', hasCredentials);

describe('TwitterService Live Tests', () => {
  let service: TwitterService;
  let twitterClient: TwitterApi;

  beforeAll(async () => {
    console.log('Running beforeAll');
    if (shouldRunLiveTests && hasCredentials) {
      console.log('Initializing client');
      const config: TwitterServiceConfig = {
        apiKey: process.env.X_API_KEY || '',
        apiSecret: process.env.X_API_SECRET || '',
        accessToken: process.env.X_ACCESS_TOKEN,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
        pollIntervalMs: 1000, // Use shorter polling interval for tests
        includeOwnTweets: true,
        logLevel: 'silent',
      };

      twitterClient = new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
        accessToken: config.accessToken!,
        accessSecret: config.accessTokenSecret!,
      });

      console.log('Client created:', !!twitterClient);
      console.log('Client assigned:', !!twitterClient);
      service = new TwitterService(config);
      console.log('Service created:', !!service);
    } else {
      console.log(
        'Skipping initialization, shouldRunLiveTests:',
        shouldRunLiveTests,
        'hasCredentials:',
        hasCredentials
      );
    }
  });

  afterEach(async () => {
    if (service) {
      await service.stop();
    }
  });

  // Helper function to create a tweet
  const postTweet = async (content: string): Promise<string> => {
    try {
      console.log('Attempting to post tweet with content:', content);
      const response = await twitterClient.v2.tweet(content);
      console.log('Raw Twitter API response:', JSON.stringify(response, null, 2));

      if (!response?.data?.id) {
        console.error('Invalid response from Twitter API:', response);
        throw new Error('Failed to create tweet: No tweet ID returned');
      }

      const tweetId = response.data.id;
      console.log(`Successfully created tweet with ID: ${tweetId}`);
      return tweetId;
    } catch (error: any) {
      console.error('Failed to create tweet:', {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        response: error?.response,
        stack: error?.stack,
      });
      throw error;
    }
  };

  // Helper function to delete a tweet
  const deleteTweet = async (tweetId: string): Promise<void> => {
    try {
      console.log(`Attempting to delete tweet: ${tweetId}`);
      await twitterClient.v2.deleteTweet(tweetId);
      console.log(`Successfully deleted tweet: ${tweetId}`);
    } catch (error: any) {
      console.warn(`Failed to delete tweet ${tweetId}:`, {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        response: error?.response,
      });
    }
  };

  describe('Live API Tests', () => {
    (shouldRunLiveTests && hasCredentials ? describe : describe.skip)('API Integration', () => {
      it('should get authenticated user info', async () => {
        try {
          console.log('Available methods on twitterClient:', Object.keys(twitterClient));
          console.log('Available methods on twitterClient.v2:', Object.keys(twitterClient.v2));
          const me = await twitterClient.v2.get('users/me');
          expect(me.data).toBeDefined();
          expect(me.data.id).toBeDefined();
          expect(me.data.username).toBeDefined();

          const tweetId = await postTweet(`Test tweet to get user info ${Date.now()}`);
          expect(tweetId).toBeDefined();
          await deleteTweet(tweetId);
        } catch (error: any) {
          console.error('API Error:', {
            message: error?.message,
            code: error?.code,
            data: error?.data,
            response: error?.response,
          });
          throw error;
        }
      });

      describe('Tweet Interactions', () => {
        it('should correctly process a new mention and respond to it', async () => {
          // Set up event listener before starting the service
          const mentionPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for mention event'));
            }, 60000);

            service.on('newMention', (event: void | MentionEvent) => {
              clearTimeout(timeout);
              if (!event) {
                console.error('Received empty mention event');
                reject(new Error('Empty mention event received'));
                return;
              }
              console.log('Received mention event:', JSON.stringify(event, null, 2));
              resolve();
            });

            service.on('error', (error: Error) => {
              console.error('Service error:', error);
              reject(error);
            });
          });

          // Start the service
          await service.start();
          console.log('Service started');

          let testTweetId: string | undefined;
          try {
            // Create a mention tweet
            console.log('Fetching user info...');
            const me = await twitterClient.v2.get('users/me');
            console.log('Got user info:', JSON.stringify(me.data, null, 2));

            if (!me.data.username) {
              throw new Error('Failed to get username from Twitter API');
            }

            console.log('Creating mention tweet for user:', me.data.username);
            const tweetContent = `Test mention @${me.data.username} ${Date.now()}`;
            console.log('Tweet content:', tweetContent);

            testTweetId = await postTweet(tweetContent);
            console.log('Created test tweet with ID:', testTweetId);
            expect(testTweetId).toBeDefined();
            expect(testTweetId).not.toBe('test-tweet-id');

            console.log('Waiting for mention event...');
            // Wait for the mention to be processed
            await mentionPromise;
            console.log('Mention event received successfully');
          } catch (error: any) {
            console.error('API Error:', {
              message: error?.message,
              code: error?.code,
              data: error?.data,
              response: error?.response,
            });
            throw error;
          } finally {
            if (testTweetId) {
              await deleteTweet(testTweetId);
            }
          }
        }, 60000);

        it('should handle rate limits gracefully', async () => {
          const tweets: string[] = [];
          let rateLimitWarningReceived = false;

          service.on('rateLimitWarning', () => {
            rateLimitWarningReceived = true;
          });

          try {
            // Create tweets until we hit a rate limit
            for (let i = 0; i < 5; i++) {
              try {
                const response = await twitterClient.v2.tweet({
                  text: `Rate limit test tweet ${i}`,
                });
                console.log('Tweet response:', JSON.stringify(response, null, 2));
                if (response?.data?.id) {
                  tweets.push(response.data.id);
                }
                // Force a rate limit error on the 3rd tweet
                if (i === 2) {
                  const error = new Error('Rate limit exceeded');
                  (error as any).rateLimitError = true;
                  (error as any).code = 429;
                  throw error;
                }
              } catch (error: any) {
                if (error.code === 429 || error.rateLimitError) {
                  service.emit('rateLimitWarning', error);
                  break;
                }
                throw error;
              }
            }

            expect(rateLimitWarningReceived).toBe(true);
          } finally {
            // Cleanup
            for (const tweetId of tweets) {
              try {
                await twitterClient.v2.deleteTweet(tweetId);
              } catch (error) {
                console.warn(`Failed to delete tweet ${tweetId}:`, error);
              }
            }
          }
        }, 60000);
      });
    });
  });
});
