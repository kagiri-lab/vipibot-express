import { Request, Response } from 'express';
import { Mention, TwitterAccount, Reply, User } from '../models';

export class MentionController {
  static async getAll(req: Request, res: Response) {
    try {
      const { accountId, page = 1, limit = 20 } = req.query;
      const whereClause: any = {};
      if (accountId) {
        whereClause.twitterAccountId = accountId;
      }

      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows } = await Mention.findAndCountAll({
        where: whereClause,
        include: [
          { model: TwitterAccount, as: 'twitterAccount', attributes: ['handle'] },
          { 
            model: Reply, 
            as: 'reply',
            include: [{ model: User, as: 'user', attributes: ['username', 'initials'] }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
        offset: offset
      });
      
      res.json({
        mentions: rows,
        total: count,
        page: Number(page),
        totalPages: Math.ceil(count / Number(limit))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error fetching mentions', error });
    }
  }
}
