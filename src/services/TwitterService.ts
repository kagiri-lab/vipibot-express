import { TwitterApi } from 'twitter-api-v2';
import { TwitterAccount } from '../models';

export class TwitterService {

  static async getRecentTweets(accountId: number) {
    const account = await TwitterAccount.findByPk(accountId);
    if (!account) throw new Error('Account not found');
    
    if (account.apiKey === 'mock_api_key') {
      return {
        data: [
          { id: '1', text: 'This is a mock recent tweet you posted!', created_at: new Date().toISOString() },
          { id: '2', text: 'Another mock tweet. Testing the compose interface.', created_at: new Date(Date.now() - 3600000).toISOString() }
        ]
      };
    }

    const client = await this.getClient(accountId);
    try {
      const me = await client.v2.me();
      if (!me || !me.data) return { data: [] };
      const timeline = await client.v2.userTimeline(me.data.id, { 
        max_results: 10,
        expansions: ['attachments.media_keys'],
        'media.fields': ['url', 'preview_image_url', 'type'],
        'tweet.fields': ['created_at', 'public_metrics']
      });
      
      const tweets = timeline.data.data || [];
      const includesMedia = timeline.data.includes?.media || [];
      
      // Map media URLs directly onto the tweets for easier frontend rendering
      const enrichedTweets = tweets.map(tweet => {
        let mediaUrls = [];
        if (tweet.attachments && tweet.attachments.media_keys) {
          tweet.attachments.media_keys.forEach(key => {
            const mediaItem = includesMedia.find(m => m.media_key === key);
            if (mediaItem) {
              if (mediaItem.type === 'photo' && mediaItem.url) mediaUrls.push(mediaItem.url);
              if (mediaItem.type === 'video' && mediaItem.preview_image_url) mediaUrls.push(mediaItem.preview_image_url);
            }
          });
        }
        return { ...tweet, mediaUrls };
      });

      return { data: enrichedTweets };
    } catch (e) {
      console.error('Error fetching user timeline:', e);
      return { data: [] };
    }
  }

  /**
   * Initializes the Twitter client for a specific account
   */
  
  static async syncDMs(accountId: number, sinceEventId?: string) {
    const client = await this.getClient(accountId);
    const options: any = { 
       event_types: 'MessageCreate', 
       expansions: ['sender_id', 'participant_ids'],
       'dm_event.fields': ['id', 'text', 'event_type', 'created_at', 'sender_id', 'participant_ids', 'dm_conversation_id'],
       max_results: 100
    };
    // Twitter v2 DM endpoint does not strictly support since_id the same way timelines do, 
    // but pagination works. For basic sync, we fetch recent events.
    try {
      const paginator = await client.v2.listDmEvents(options);
      let allEvents = [];
      
      for await (const event of paginator) {
        allEvents.push(event);
        if (allEvents.length >= 500) break; // limit to 500 max to prevent infinite loops
      }
      
      return allEvents;
    } catch(e) {
      console.error('Error fetching DMs:', e);
      return [];
    }
  }

  static async sendDM(accountId: number, participantId: string, text: string) {
    const client = await this.getClient(accountId);
    try {
      const res = await client.v2.sendDmToParticipant(participantId, { text });
      return res;
    } catch(e) {
      console.error('Error sending DM:', e);
      throw e;
    }
  }

  static async getClient(accountId: number): Promise<TwitterApi> {
    const account = await TwitterAccount.findByPk(accountId);
    if (!account || !account.isActive) {
      throw new Error('Twitter account not found or inactive');
    }

    if (account.authMethod === 'OAUTH2' && account.refreshToken) {
      const client = new TwitterApi({
        clientId: account.apiKey,
        clientSecret: account.apiSecret,
      });
      
      try {
        const { client: refreshedClient, accessToken, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(account.refreshToken);
        
        await account.update({
          accessToken,
          refreshToken: newRefreshToken
        });
        
        return refreshedClient;
      } catch (err) {
        if (account.accessToken) {
          return new TwitterApi(account.accessToken);
        }
        throw new Error('OAuth2 Token Refresh Failed and no valid Access Token exists.');
      }
    } else if (account.authMethod === 'BEARER' && account.bearerToken) {
      return new TwitterApi(account.bearerToken);
    } else {
      return new TwitterApi({
        appKey: account.apiKey,
        appSecret: account.apiSecret,
        accessToken: account.accessToken || '',
        accessSecret: account.accessTokenSecret || '',
      });
    }
  }

  /**
   * Fetches mentions for a specific account.
   */
  static async fetchMentions(accountId: number, sinceId?: string) {
    const client = await this.getClient(accountId);
    const account = await TwitterAccount.findByPk(accountId);
    
    let targetUserId = '';
    if (account?.authMethod === 'BEARER') {
       const user = await client.v2.userByUsername(account.handle);
       if (!user.data) throw new Error('Could not find user by handle');
       targetUserId = user.data.id;
    } else {
       const me = await client.v2.me();
       targetUserId = me.data.id;
    }
    
    const mentions = await client.v2.userMentionTimeline(targetUserId, {
      max_results: 50,
      ...(sinceId ? { since_id: sinceId } : {}),
      expansions: ['referenced_tweets.id', 'author_id', 'attachments.media_keys'],
      'user.fields': ['profile_image_url'],
      'media.fields': ['url', 'preview_image_url'],
      'tweet.fields': ['created_at', 'conversation_id', 'referenced_tweets'],
    });

    return mentions;
  }

  /**
   * Post a reply to a tweet
   */
  static async replyToTweet(accountId: number, tweetId: string, text: string) {
    return this.postTweet(accountId, text, tweetId);
  }

  /**
   * Broadcast a new tweet (or reply by ID)
   */
  static async postTweet(accountId: number, text: string, replyToTweetId?: string, mediaBuffer?: Buffer, mediaMimeType?: string) {
    const account = await TwitterAccount.findByPk(accountId);
    
    if (account && account.apiKey === 'mock_api_key') {
      console.log(`[MOCK TWITTER API] Posting tweet (ReplyTo: ${replyToTweetId || 'none'}): ${text}`);
      return { data: { id: 'mock_tweet_id', text } };
    }

    if (account && account.authMethod === 'BEARER') {
       throw new Error('Cannot post tweets using only a Bearer Token. X requires User Context to post.');
    }

    const client = await this.getClient(accountId);
    
    const payload: any = { text };
    if (replyToTweetId) {
      payload.reply = { in_reply_to_tweet_id: replyToTweetId };
    }

    // Handle Media Upload if provided
    if (mediaBuffer && mediaMimeType) {
      try {
        const mediaId = await client.v1.uploadMedia(mediaBuffer, { mimeType: mediaMimeType });
        payload.media = { media_ids: [mediaId] };
      } catch (mediaError) {
        console.error('Failed to upload media:', mediaError);
        throw new Error('Failed to upload media to X');
      }
    }

    try {
      const response = await client.v2.tweet(payload);
      return response;
    } catch (err: any) {
      const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
      if (replyToTweetId && (errStr.includes('You can only reply to or quote posts') || (err.message && err.message.includes('You can only reply to or quote posts')))) {
         console.log('[FALLBACK] X API Tier blocked direct reply. Falling back to standalone Quote-Link tweet.');
         delete payload.reply;
         payload.text = `${payload.text}\n\nhttps://twitter.com/i/web/status/${replyToTweetId}`;
         const fallbackResponse = await client.v2.tweet(payload);
         return fallbackResponse;
      }
      throw err;
    }
  }

  static async deleteTweet(accountId: number, tweetId: string) {
    const client = await this.getClient(accountId);
    try {
      const response = await client.v2.deleteTweet(tweetId);
      return response;
    } catch (err) {
      console.error('Error deleting tweet from Twitter:', err);
      throw err;
    }
  }

}