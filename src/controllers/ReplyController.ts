import { Request, Response } from 'express';
import { Mention, Reply, User } from '../models';
import { TwitterService } from '../services/TwitterService';
import { AuthRequest } from '../middlewares/authMiddleware';

export class ReplyController {
  static async postReply(req: AuthRequest, res: Response) {
    try {
      const { mentionId, text } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const mention = await Mention.findByPk(mentionId);
      if (!mention) return res.status(404).json({ message: 'Mention not found' });
      if (mention.status === 'REPLIED') return res.status(400).json({ message: 'Already replied to this mention' });

      // Append initials to text
      const finalText = `${text} ^${user.initials}`;

      // Send to Twitter
      const twitterResponse = await TwitterService.replyToTweet(mention.twitterAccountId, mention.tweetId, finalText);

      // Save Reply to DB
      const reply = await Reply.create({
        mentionId: mention.id,
        userId: user.id,
        replyText: finalText
      });

      // Update Mention Status
      mention.status = 'REPLIED';
      await mention.save();

      res.status(201).json({ message: 'Reply posted', reply });
    } catch (error) {
      console.error('Reply Error:', error);
      res.status(500).json({ message: 'Error posting reply', error });
    }
  }
}
