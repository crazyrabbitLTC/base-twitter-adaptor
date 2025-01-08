import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi, TweetV2, ReferencedTweetV2, TTweetv2Expansion } from 'twitter-api-v2';
import express from 'express';
import axios from 'axios';
import { Server } from 'http';

// Skip these tests if not in CI or if credentials are not provided
const shouldRunLiveTests = process.env.CI || process.env.RUN_LIVE_TESTS;

// Only run these tests if we have the required environment variables
const hasCredentials = 
  process.env.X_API_KEY &&
  process.env.X_API_SECRET &&
  (process.env.X_BEARER_TOKEN || (process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET));

describe('TwitterService Live Tests', () => {
  let service: TwitterService;
  let twitterClient: TwitterApi;

  const config: TwitterServiceConfig = {
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    webhookPort: 3000,
    bearerToken: process.env.X_BEARER_TOKEN,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };

  beforeAll(() => {
    if (shouldRunLiveTests && !hasCredentials) {
      throw new Error(
        'Missing X API credentials. Set X_API_KEY, X_API_SECRET, and either X_BEARER_TOKEN or both X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET environment variables.'
      );
    }
  });

  beforeEach(() => {
    if (shouldRunLiveTests && hasCredentials) {
      service = new TwitterService(config);
      // Initialize the test client with the most specific credentials available
      if (process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET) {
        twitterClient = new TwitterApi({
          appKey: config.apiKey,
          appSecret: config.apiSecret,
          accessToken: config.accessToken!,
          accessSecret: config.accessTokenSecret!,
        });
      } else {
        twitterClient = new TwitterApi(config.bearerToken!);
      }
    }
  });

  afterEach(async () => {
    // Cleanup: Stop the service after each test
    if (service) {
      await service.stop();
    }
  });

  // Helper function to create a test tweet
  const createTestTweet = async (content: string): Promise<string> => {
    const tweet = await twitterClient.v2.tweet(content);
    return tweet.data.id;
  };

  // Helper function to delete a test tweet
  const deleteTestTweet = async (tweetId: string): Promise<void> => {
    try {
      await twitterClient.v2.deleteTweet(tweetId);
    } catch (error) {
      console.warn(`Failed to delete test tweet ${tweetId}:`, error);
    }
  };

  // Helper function to wait for server to be ready
  const waitForServer = async (port: number, maxAttempts = 10): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`http://localhost:${port}/health`);
        return;
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  describe('Live API Tests', () => {
    // Skip all tests if we're not running live tests
    (shouldRunLiveTests && hasCredentials ? describe : describe.skip)('API Integration', () => {
      describe('Tweet Interactions', () => {
        it('should correctly process a new mention and respond to it', async () => {
          await service.start();
          const testTweetId = await createTestTweet('Test mention tweet');
          
          try {
            return new Promise<void>((resolve) => {
              service.on('newMention', async (mention: MentionEvent) => {
                expect(mention).toBeDefined();
                expect(mention.tweetId).toBe(testTweetId);
                
                // Test replying to the tweet
                await service['replyToTweet'](mention.tweetId, 'Test reply');
                
                // Verify the reply
                const timeline = await twitterClient.v2.userTimeline(mention.userId, {
                  expansions: ['referenced_tweets.id'] as TTweetv2Expansion[],
                });

                const reply = timeline.tweets.find((t: TweetV2) =>
                  t.referenced_tweets?.some((ref: ReferencedTweetV2) =>
                    ref.type === 'replied_to' && ref.id === testTweetId
                  )
                );
                
                expect(reply).toBeDefined();
                expect(reply?.text).toBe('Test reply');
                
                resolve();
              });
            });
          } finally {
            // Cleanup
            await deleteTestTweet(testTweetId);
          }
        }, 30000); // Increase timeout for API calls

        it('should handle rate limits gracefully', async () => {
          await service.start();
          const tweets: string[] = [];
          
          try {
            // Create multiple tweets rapidly to trigger rate limit
            for (let i = 0; i < 5; i++) {
              const tweetId = await createTestTweet(`Rate limit test tweet ${i}`);
              tweets.push(tweetId);
            }
            
            let rateLimitWarningReceived = false;
            service.on('rateLimitWarning', () => {
              rateLimitWarningReceived = true;
            });
            
            // Try to reply to all tweets rapidly
            await Promise.all(
              tweets.map(tweetId => 
                service['replyToTweet'](tweetId, 'Test reply')
              )
            );
            
            expect(rateLimitWarningReceived).toBe(true);
          } finally {
            // Cleanup
            await Promise.all(tweets.map(deleteTestTweet));
          }
        }, 60000); // Increase timeout for rate limit test
      });

      describe('Thread Management', () => {
        it('should maintain thread history across multiple interactions', async () => {
          await service.start();
          const threadId = 'test-thread-' + Date.now();
          const messages = Array.from({ length: 60 }, (_, i) => ({
            senderId: 'test-user',
            timestamp: Date.now() + i,
            content: `Message ${i}`,
          }));
          
          // Add messages to the thread
          for (const msg of messages) {
            service['addMessageToThread'](threadId, msg);
          }
          
          // Get thread context
          const context = service['getThreadContext'](threadId);
          
          // Verify thread history limit is respected
          expect(context.history).toHaveLength(50);
          
          // Verify we have the most recent messages
          const lastMessage = messages[messages.length - 1];
          expect(context.history[context.history.length - 1]).toEqual(lastMessage);
        });
      });
    });
  });

  describe('Webhook Error Handling', () => {
    // Skip all tests if we're not running live tests
    (shouldRunLiveTests && hasCredentials ? describe : describe.skip)('Webhook Tests', () => {
      it('should handle malformed webhook payload', async () => {
        // Start the service first
        await service.start();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for service to be ready

        // Create a test server to send requests
        const testApp = express();
        testApp.use(express.json());
        const testPort = 3001;

        let testServer: Server | undefined;
        try {
          testServer = await new Promise<Server>((resolve, reject) => {
            const server = testApp.listen(testPort, () => resolve(server));
            server.on('error', reject);
          });

          // Test cases for different types of invalid data
          const testCases = [
            {
              name: 'malformed JSON',
              data: 'invalid json',
              expectedStatus: 400
            },
            {
              name: 'missing required fields',
              data: { some: 'data' },
              expectedStatus: 400
            },
            {
              name: 'invalid event type',
              data: {
                for_user_id: '123',
                unknown_event: []
              },
              expectedStatus: 400
            }
          ];

          for (const testCase of testCases) {
            try {
              const response = await axios.post(
                `http://localhost:${config.webhookPort}/webhook`,
                testCase.data,
                {
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  validateStatus: () => true,
                  timeout: 5000
                }
              );

              // Only store status to avoid circular references
              const result = { status: response.status };
              expect(result.status).toBe(testCase.expectedStatus);
            } catch (error: any) {
              // Log error message only to avoid circular references
              console.error(`Failed to test case ${testCase.name}:`, error?.message || 'Unknown error');
              throw new Error(`Test case ${testCase.name} failed: ${error?.message || 'Unknown error'}`);
            }
          }

          // Test missing signature
          try {
            const response = await axios.post(
              `http://localhost:${config.webhookPort}/webhook`,
              { valid: 'data' },
              {
                validateStatus: () => true,
                timeout: 5000
              }
            );
            expect(response.status).toBe(401);
          } catch (error: any) {
            console.error('Failed to test missing signature:', error?.message || 'Unknown error');
            throw new Error(`Missing signature test failed: ${error?.message || 'Unknown error'}`);
          }

          // Test invalid signature
          try {
            const response = await axios.post(
              `http://localhost:${config.webhookPort}/webhook`,
              { valid: 'data' },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-twitter-webhooks-signature': 'invalid'
                },
                validateStatus: () => true,
                timeout: 5000
              }
            );
            expect(response.status).toBe(401);
          } catch (error: any) {
            console.error('Failed to test invalid signature:', error?.message || 'Unknown error');
            throw new Error(`Invalid signature test failed: ${error?.message || 'Unknown error'}`);
          }

        } finally {
          // Cleanup
          if (testServer) {
            await new Promise<void>((resolve) => {
              testServer!.close(() => resolve());
            });
          }
          await service.stop();
        }
      }, 30000);
    });
  });
}); 