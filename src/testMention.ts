import { TwitterService } from './TwitterService';
import { TwitterServiceConfig, MentionEvent } from './types';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
   const config: TwitterServiceConfig = {
       apiKey: process.env.X_API_KEY!,
       apiSecret: process.env.X_API_SECRET!,
       accessToken: process.env.X_ACCESS_TOKEN,
       accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
       pollIntervalMs: 10000, // Poll every 10 seconds for faster testing
       sinceId: "1877195444486345042",
       includeOwnTweets: true,
       logLevel: "silent"
   };

   const twitterService = new TwitterService(config);

   // Set up a listener for the newMention event
   twitterService.on('newMention', (mention: MentionEvent) => {
       console.log('\n----- New Mention Received -----');
       console.log('  Tweet ID:', mention.tweetId);
       console.log('  Thread ID:', mention.threadId);
       console.log('  User ID:', mention.userId);
       console.log('  Message:', mention.message);
       console.log('------------------------------\n');
      //  process.exit(0); // Exit the process after a new mention
   });

   // Start the service
   await twitterService.start();
   console.log('Twitter service started. Awaiting a NEW mention. Make sure to mention the account configured in the env file.');


   // Keep the process running so it can receive events
   process.on('SIGINT', async () => {
       console.log('Stopping Twitter service...');
       await twitterService.stop();
       process.exit(0);
   });
}

main().catch(error => {
   console.error('An error occurred during testing:', error);
   process.exit(1);
});