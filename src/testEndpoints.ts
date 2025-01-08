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
        const waitTime = resetTime 
          ? (Number(resetTime) * 1000 - Date.now() + 5000)
          : baseDelay * Math.pow(2, retries);
        
        console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)} seconds before retry...`);
        await delay(waitTime);
        retries++;
      } else {
        throw error;
      }
    }
  }
}

async function runEndpointTests() {
  console.log('Starting Twitter API endpoint tests...\n');

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  let testTweetId: string | undefined;

  try {
    // 1. Test user authentication (me endpoint)
    console.log('1. Testing user authentication (me endpoint)');
    const userInfo = await retryWithBackoff(() => client.v2.get('users/me'));
    console.log('✅ Successfully got user info:', userInfo);
    console.log();

    await delay(5000);

    // 2. Test tweet creation
    console.log('2. Testing tweet creation');
    const tweet = await retryWithBackoff(() => 
      client.v2.tweet(`Test tweet for endpoint verification ${Date.now()}`)
    );
    testTweetId = tweet.data.id;
    console.log('✅ Successfully created tweet:', tweet);
    console.log();

    await delay(5000);

    // 3. Test reply to tweet
    console.log('3. Testing reply to tweet');
    try {
      const reply = await retryWithBackoff(() => 
        client.v2.tweet({
          text: `Test reply for endpoint verification ${Date.now()}`,
          reply: {
            in_reply_to_tweet_id: testTweetId!
          }
        })
      );
      console.log('✅ Successfully replied to tweet:', reply);
    } catch (error: any) {
      console.error('Error with tweets:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      console.log('❌ Failed to reply to tweet');
    }

    await delay(5000);

    // 4. Clean up tweets
    console.log('\n4. Cleaning up tweets');
    if (testTweetId) {
      const deleteResponse = await retryWithBackoff(() => 
        client.v2.deleteTweet(testTweetId!)
      );
      console.log('✅ Successfully deleted tweet:', deleteResponse);
    }

  } catch (error: any) {
    console.error('Error during endpoint testing:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
  }
}

runEndpointTests(); 