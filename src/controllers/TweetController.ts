import { Request, Response } from 'express';
import { TwitterService } from '../services/TwitterService';

export class TweetController {
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
        mediaBuffer = file.buffer;
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
}
