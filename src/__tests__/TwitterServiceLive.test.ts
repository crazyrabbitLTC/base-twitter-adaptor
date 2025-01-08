import { TwitterService } from '../index';
import { TwitterServiceConfig, MentionEvent } from '../types';
import { TwitterApi, TweetV2, ReferencedTweetV2, TTweetv2Expansion } from 'twitter-api-v2';

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

  describe('Live API Tests', () => {
    // Skip all tests if we're not running live tests
    (shouldRunLiveTests && hasCredentials ? describe : describe.skip)('API Integration', () => {
      describe('Tweet Interactions', () => {
        it('should correctly process a new mention and respond to it', async () => {
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
}); 