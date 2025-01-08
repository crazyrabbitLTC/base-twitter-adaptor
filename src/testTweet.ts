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

async function testTweet() {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    // Create a test tweet
    console.log('1. Creating test tweet');
    const tweet = await retryWithBackoff(() => 
      client.v2.tweet(`Test tweet ${Date.now()}`)
    );
    console.log('✅ Tweet created successfully:', tweet);

    await delay(5000);

    // Create a reply to the tweet
    console.log('\n2. Creating reply to test tweet');
    const reply = await retryWithBackoff(() => 
      client.v2.tweet({
        text: `Test reply ${Date.now()}`,
        reply: {
          in_reply_to_tweet_id: tweet.data.id
        }
      })
    );
    console.log('✅ Reply created successfully:', reply);

    await delay(5000);

    // Delete both tweets
    console.log('\n3. Cleaning up tweets');
    const deleteTweet = await retryWithBackoff(() => 
      client.v2.deleteTweet(tweet.data.id)
    );
    console.log('✅ Original tweet deleted:', deleteTweet);

    await delay(2000);

    const deleteReply = await retryWithBackoff(() => 
      client.v2.deleteTweet(reply.data.id)
    );
    console.log('✅ Reply deleted:', deleteReply);

  } catch (error: any) {
    console.error('Error during tweet testing:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
  }
}

testTweet(); 