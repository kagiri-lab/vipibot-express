import { Op } from 'sequelize';
import { Request, Response } from 'express';
import { Mention, TwitterAccount, Reply, User } from '../models';

export class MentionController {
  static async getAll(req: Request, res: Response) {
    try {
      const { accountId, page = 1, limit = 20 } = req.query;
      const whereClause: any = { [Op.or]: [{ isHidden: false }, { isHidden: null }] };
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

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const mention = await Mention.findByPk(id);
      
      if (!mention) {
        return res.status(404).json({ error: 'Mention not found' });
      }
      
      mention.isHidden = true;
      await mention.save();
      return res.status(200).json({ message: 'Mention deleted successfully' });
    } catch (error) {
      console.error('Error deleting mention:', error);
      return res.status(500).json({ error: 'Failed to delete mention' });
    }
  }

  static async blockUser(req: Request, res: Response) {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username is required' });

      // 1. Add to blocked_handles system setting
      const { SystemSetting } = require('../models');
      const setting = await SystemSetting.findOrCreate({ where: { key: 'blocked_handles' }, defaults: { value: '' } });
      const currentBlocked = setting[0].value ? setting[0].value.split(',').map((u: string) => u.trim().toLowerCase()) : [];
      
      if (!currentBlocked.includes(username.toLowerCase())) {
        currentBlocked.push(username.toLowerCase());
        setting[0].value = currentBlocked.join(',');
        await setting[0].save();
      }

      // 2. Hide all existing mentions from this user
      await Mention.update({ isHidden: true }, { where: { authorUsername: username } });

      res.json({ message: `User @${username} has been blocked and all their mentions hidden.` });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  }
}
