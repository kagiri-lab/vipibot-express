import { Request, Response } from 'express';
import { TwitterAccount } from '../models';

export class TwitterAccountController {
  static async getAll(req: Request, res: Response) {
    try {
      const accounts = await TwitterAccount.findAll({ attributes: { exclude: ['apiSecret', 'accessTokenSecret', 'refreshToken'] } });
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching accounts', error });
    }
  }

  
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const account = await TwitterAccount.findByPk(id);
      if (!account) return res.status(404).json({ message: 'Account not found' });
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: 'Server error fetching account' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { handle, authMethod, apiKey, apiSecret, bearerToken, accessToken, accessTokenSecret, refreshToken, replyMode } = req.body;
      const account = await TwitterAccount.create({
        handle, authMethod, apiKey, apiSecret, bearerToken, accessToken, accessTokenSecret, refreshToken, replyMode
      });
      res.status(201).json({ message: 'Account added', accountId: account.id });
    } catch (error) {
      res.status(500).json({ message: 'Error adding account', error });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { handle, authMethod, apiKey, apiSecret, bearerToken, accessToken, accessTokenSecret, refreshToken, replyMode } = req.body;
      
      const account = await TwitterAccount.findByPk(id);
      if (!account) return res.status(404).json({ message: 'Account not found' });

      await account.update({
        handle, authMethod, apiKey, apiSecret, bearerToken, accessToken, accessTokenSecret, refreshToken, replyMode
      });
      
      res.json({ message: 'Account updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating account', error });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await TwitterAccount.destroy({ where: { id } });
      res.json({ message: 'Account deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting account', error });
    }
  }
}
