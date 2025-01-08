import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';

dotenv.config();

async function registerWebhook() {
  const webhookUrl = 'https://e639-151-205-184-89.ngrok-free.app/webhook/twitter';
  
  try {
    // Initialize the Twitter client with the new credentials
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });

    // Verify credentials
    console.log('Verifying credentials...');
    const me = await client.v2.users.me();
    console.log('Authenticated as:', JSON.stringify(me.data, null, 2));

    // Get the bearer token
    console.log('\nGetting app context...');
    const appClient = await client.appLogin();
    console.log('App authentication successful');

    // List current webhooks
    console.log('\nListing current webhooks...');
    const currentWebhooks = await client.v2.get('webhook/subscriptions/list');
    console.log('Current webhooks:', JSON.stringify(currentWebhooks.data, null, 2));

    // Register new webhook
    console.log('\nRegistering webhook...');
    const registerResponse = await client.v2.post('webhook/subscriptions/create', {
      url: webhookUrl,
      enabled: true
    });
    console.log('Registration response:', JSON.stringify(registerResponse.data, null, 2));

    // Subscribe to events
    console.log('\nSubscribing to webhook events...');
    const subscribeResponse = await client.v2.post('webhook/subscriptions/subscribe', {
      webhook_id: registerResponse.data.id,
      subscription_type: 'all'
    });
    console.log('Subscription response:', JSON.stringify(subscribeResponse.data, null, 2));

    console.log('\nWebhook setup completed!');
    console.log('Webhook URL:', webhookUrl);

  } catch (error: any) {
    console.error('Error:', {
      message: error?.message,
      status: error?.code,
      data: error?.data
    });
    
    if (error?.code === 403) {
      console.error('\nIt seems your API keys might not have the required permissions.');
      console.log('\nPlease ensure:');
      console.log('1. Your Twitter App has "Read, Write, and Direct Messages" permissions');
      console.log('2. The callback URLs in the Twitter Developer Portal include:');
      console.log(`   - ${webhookUrl}`);
      console.log('3. You have regenerated your access tokens after updating permissions');
    }
  }
}

registerWebhook(); 