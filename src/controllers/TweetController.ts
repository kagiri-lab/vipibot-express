import fs from 'fs';
import { Request, Response } from 'express';
import { TwitterService } from '../services/TwitterService';

export class TweetController {

  static async getRecentTweets(req: Request, res: Response) {
    try {
      const { accountId } = req.params;
      const response = await TwitterService.getRecentTweets(parseInt(accountId, 10));
      res.json({ data: response.data });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch recent tweets', error: error.message || String(error) });
    }
  }

  static async postTweet(req: Request, res: Response) {
    try {
      const { accountId, text, replyToTweetId } = req.body;
      const file = req.file;

      if (!accountId || !text) {
        return res.status(400).json({ message: 'accountId and text are required' });
      }

      let mediaBuffer: Buffer | undefined;
      let mediaMimeType: string | undefined;

      if (file) {
        if (file.buffer) {
          mediaBuffer = file.buffer;
        } else if (file.path) {
          mediaBuffer = fs.readFileSync(file.path);
          // Optional: fs.unlinkSync(file.path); // clean up after reading
        }
        mediaMimeType = file.mimetype;
      }

      const response = await TwitterService.postTweet(
        parseInt(accountId, 10), 
        text, 
        replyToTweetId,
        mediaBuffer,
        mediaMimeType
      );
      
      res.json({ message: 'Tweet posted successfully', data: response.data });
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      
      let errMessage = error.message || String(error);
      if (error.data && error.data.detail) {
         errMessage = error.data.detail;
      } else if (error.data && error.data.title) {
         errMessage = error.data.title;
      }
      
      res.status(500).json({ message: 'Failed to post tweet', error: errMessage });
    }
  }

  static async deleteTweet(req: Request, res: Response) {
    try {
      const { accountId, tweetId } = req.params;
      await TwitterService.deleteTweet(parseInt(accountId, 10), tweetId);
      res.json({ message: 'Tweet deleted successfully from X' });
    } catch (error: any) {
      console.error('Error deleting tweet:', error);
      res.status(500).json({ message: 'Failed to delete tweet', error: error.message || String(error) });
    }
  }

}