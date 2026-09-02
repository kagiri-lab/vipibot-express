import { Request, Response } from 'express';
import { TargetAccount, TwitterAccount } from '../models';
import { TwitterService } from '../services/TwitterService';

export class TargetAccountController {
  
  static async getTargetTweets(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const target = await TargetAccount.findByPk(id);
      if (!target) return res.status(404).json({ message: 'Target not found' });
      
      const client = await TwitterService.getClient(target.ownerAccountId);
      const { pagination_token } = req.query;
      const options: any = {
        max_results: 15,
        exclude: ['retweets', 'replies'],
        expansions: ['attachments.media_keys', 'author_id'],
        'media.fields': ['url', 'preview_image_url', 'type', 'variants'],
        'user.fields': ['profile_image_url'],
        'tweet.fields': ['created_at', 'public_metrics']
      };
      if (pagination_token) options.pagination_token = pagination_token;

      const timeline = await client.v2.userTimeline(target.twitterId, options);
      
      let tweets = [];
      if (timeline.data && timeline.data.data) {
        tweets = timeline.data.data.map((t: any) => {
          let mediaItems: any[] = [];
          if (t.attachments?.media_keys && timeline.data.includes?.media) {
            t.attachments.media_keys.forEach((mediaKey: string) => {
              const media = timeline.data.includes.media.find((m: any) => m.media_key === mediaKey);
              if (media) {
                let videoUrl = null;
                if (media.variants && media.variants.length > 0) {
                  // Get highest bitrate mp4 if available
                  const mp4s = media.variants.filter((v: any) => v.content_type === 'video/mp4');
                  if (mp4s.length > 0) {
                    mp4s.sort((a: any, b: any) => (b.bit_rate || 0) - (a.bit_rate || 0));
                    videoUrl = mp4s[0].url;
                  }
                }
                mediaItems.push({
                  type: media.type, // 'photo', 'video', 'animated_gif'
                  url: videoUrl || media.url || media.preview_image_url,
                  previewUrl: media.preview_image_url || media.url
                });
              }
            });
          }
          return {
            id: t.id,
            text: t.text,
            created_at: t.created_at,
            metrics: t.public_metrics,
            mediaItems
          };
        });
      }
      
      let profileImageUrl = null;
      if (timeline.data && timeline.data.includes && timeline.data.includes.users) {
        profileImageUrl = timeline.data.includes.users[0]?.profile_image_url;
      }
      res.json({ data: tweets, profileImageUrl, meta: timeline.meta || {} });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Error fetching target tweets', error: error.message });
    }
  }

  static async proxyMedia(req: Request, res: Response) {
    try {
      const videoUrl = req.query.url as string;
      if (!videoUrl) return res.status(400).send('URL required');
      
      const https = require('https');
      const options = {
        headers: {
          'Referer': 'https://twitter.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
        }
      };
      
      if (req.headers.range) {
        options.headers['Range'] = req.headers.range;
      }

      https.get(videoUrl, options, (proxyRes: any) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }).on('error', (err: any) => {
        res.status(500).send(err.message);
      });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async getTweetReplies(req: Request, res: Response) {
    try {
      const { id, tweetId } = req.params;
      const target = await TargetAccount.findByPk(id);
      if (!target) return res.status(404).json({ message: 'Target not found' });
      
      const client = await require('../services/TwitterService').TwitterService.getClient(target.ownerAccountId);
      
      // We must search for tweets that are part of this conversation but NOT from the author themselves (optional, but usually we just want public replies)
      const searchRes = await client.v2.search(`conversation_id:${tweetId} -from:${target.twitterId}`, {
        max_results: 10,
        expansions: ['author_id'],
        'user.fields': ['profile_image_url', 'username'],
        'tweet.fields': ['created_at', 'public_metrics']
      });

      let replies = [];
      if (searchRes.data && searchRes.data.data) {
        replies = searchRes.data.data.map((t: any) => {
          let author = { username: 'unknown', profile_image_url: null };
          if (searchRes.data.includes && searchRes.data.includes.users) {
            const foundUser = searchRes.data.includes.users.find((u: any) => u.id === t.author_id);
            if (foundUser) {
              author.username = foundUser.username;
              author.profile_image_url = foundUser.profile_image_url;
            }
          }
          return {
            id: t.id,
            text: t.text,
            created_at: t.created_at,
            metrics: t.public_metrics,
            author
          };
        });
      }

      res.json({ data: replies });
    } catch (error: any) {
      console.error('Error fetching replies:', error);
      res.status(500).json({ message: 'Error fetching replies', error: error.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const targets = await TargetAccount.findAll({
        include: [{ model: TwitterAccount, attributes: ['id', 'handle'] }]
      });
      res.json(targets);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching target accounts', error });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { handle, ownerAccountId, tone } = req.body;
      if (!handle || !ownerAccountId) {
        return res.status(400).json({ message: 'handle and ownerAccountId are required' });
      }

      // We need to look up the target's twitterId.
      const ownerAccount = await TwitterAccount.findByPk(ownerAccountId);
      if (!ownerAccount) {
         return res.status(404).json({ message: 'Owner Twitter account not found' });
      }

      let twitterId = '';
      if (ownerAccount.apiKey === 'mock_api_key') {
         twitterId = 'mock_target_' + handle;
      } else {
         const client = await TwitterService.getClient(ownerAccount.id);
         const userReq = await client.v2.userByUsername(handle.replace('@', ''));
         if (userReq.errors || !userReq.data) {
            return res.status(404).json({ message: 'Could not find that X account' });
         }
         twitterId = userReq.data.id;
      }

      const target = await TargetAccount.create({
        handle: handle.replace('@', ''),
        twitterId,
        ownerAccountId,
        tone: tone || null,
        isActive: true
      });

      res.status(201).json(target);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Error adding target account', error: error.message });
    }
  }

  static async toggleActive(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const target = await TargetAccount.findByPk(id);
      if (!target) return res.status(404).json({ message: 'Target not found' });
      
      target.isActive = !target.isActive;
      await target.save();
      res.json(target);
    } catch (error) {
      res.status(500).json({ message: 'Error updating target account', error });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await TargetAccount.destroy({ where: { id } });
      res.json({ message: 'Target account removed' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting target account', error });
    }
  }
}
