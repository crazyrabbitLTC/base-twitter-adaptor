import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

async function checkAuth() {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    const me = await client.v2.users.me();
    console.log('Authenticated as:', me.data);
  } catch (error) {
    console.error('Authentication error:', error);
  }
}

checkAuth(); 