import { Request, Response } from 'express';
import { User, TwitterAccount, Mention, Reply } from '../models';
import { Op } from 'sequelize';
import moment from 'moment';

export class StatsController {
  static async getOverview(req: Request, res: Response) {
    try {
      const { accountId } = req.query;
      
      const mentionWhere: any = {};
      const includeClause: any = [];
      
      if (accountId) {
        mentionWhere.twitterAccountId = accountId;
        includeClause.push({
          model: Mention,
          as: 'mention',
          where: { twitterAccountId: accountId },
          attributes: []
        });
      }

      // Global stats
      const usersCount = await User.count({ where: { isActive: true } });
      const accountsCount = await TwitterAccount.count();

      // 1. Top line stats
      const mentionsCount = await Mention.count({ where: mentionWhere });
      const repliesCount = await Reply.count({
        include: includeClause.length > 0 ? includeClause : undefined
      });
      
      const responseRate = mentionsCount === 0 ? 0 : Math.round((repliesCount / mentionsCount) * 100);

      // 2. Daily Graph Data (Last 7 Days)
      const graphData = [];
      for (let i = 6; i >= 0; i--) {
        const startOfDay = moment().subtract(i, 'days').startOf('day').toDate();
        const endOfDay = moment().subtract(i, 'days').endOf('day').toDate();
        const dateLabel = moment().subtract(i, 'days').format('MMM DD');

        const mCount = await Mention.count({
          where: {
            ...mentionWhere,
            createdAt: { [Op.between]: [startOfDay, endOfDay] }
          }
        });

        const rCount = await Reply.count({
          where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } },
          include: includeClause.length > 0 ? includeClause : undefined
        });

        graphData.push({
          name: dateLabel, // recharts prefers 'name' or 'date'
          Mentions: mCount,
          Replies: rCount,
        });
      }
      
      // 3. Recent Activity
      const recentMentions = await Mention.findAll({
        where: mentionWhere,
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [{ model: TwitterAccount, as: 'twitterAccount', attributes: ['handle'] }]
      });

      res.json({
        stats: {
          activeUsers: usersCount,
          connectedAccounts: accountsCount,
          totalMentions: mentionsCount,
          totalReplies: repliesCount,
          responseRate: responseRate
        },
        graphData,
        recentActivity: recentMentions
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error fetching stats', error });
    }
  }
}
