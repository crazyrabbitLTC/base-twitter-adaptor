import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 5000
): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (error?.data?.status === 429 && retries < maxRetries) {
        const resetTime = error.headers?.['x-rate-limit-reset'];
        const waitTime = resetTime ? Number(resetTime) * 1000 - Date.now() + 5000 : baseDelay * Math.pow(2, retries);

        console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds before retry...`);
        await delay(waitTime);
        retries++;
      } else {
        throw error;
      }
    }
  }
}

async function runTests() {
  console.log('Starting Twitter API tests...\n');

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    // 1. Test user authentication
    console.log('1. Testing user authentication');
    const userInfo = await retryWithBackoff(() => client.v2.get('users/me'));
    console.log('✅ User info:', userInfo);
    console.log();

    // Add longer delay between operations
    await delay(500);

    // 2. Test tweet creation
    console.log('2. Testing tweet creation');
    const tweet = await retryWithBackoff(() => client.v2.tweet(`Test tweet ${Date.now()}`));
    console.log('✅ Tweet created:', tweet);
    console.log();

    await delay(5000);

    // 3. Test reply to tweet
    console.log('3. Testing reply to tweet');
    const reply = await retryWithBackoff(() =>
      client.v2.tweet({
        text: `Test reply ${Date.now()}`,
        reply: {
          in_reply_to_tweet_id: tweet.data.id,
        },
      })
    );
    console.log('✅ Reply created:', reply);
    console.log();

    await delay(5000);

    // 4. Test tweet deletion
    console.log('4. Testing tweet deletion');
    const deletion = await retryWithBackoff(() => client.v2.deleteTweet(tweet.data.id));
    console.log('✅ Tweet deleted:', deletion);
    console.log();

    await delay(2000);

    // Clean up the reply as well
    await retryWithBackoff(() => client.v2.deleteTweet(reply.data.id));
  } catch (error: any) {
    console.error('Error during API testing:', {
      message: error?.message,
      code: error?.code,
      data: error?.data,
    });
    process.exit(1);
  }

  console.log('API testing completed');
}

runTests().catch(console.error);
