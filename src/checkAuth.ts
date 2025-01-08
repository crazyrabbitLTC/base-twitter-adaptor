import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

export async function checkAuth() {
  try {
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });

    const me = await client.v2.get('users/me');
    console.log("Successfully authenticated as:", me.data);
    return true;
  } catch (error) {
    console.error("Authentication failed:", error);
    return false;
  }
}

checkAuth(); 