import { TwitterApi } from 'twitter-api-v2';
import { TwitterAccount } from '../models';

export class TwitterService {
  /**
   * Initializes the Twitter client for a specific account
   */
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

    const response = await client.v2.tweet(payload);
    return response;
  }
}
