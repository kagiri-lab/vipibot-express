import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Session } from '../models';
import { AuthRequest } from '../middlewares/authMiddleware';

export class ProfileController {
  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findByPk(req.user.id);
      
      if (!user) return res.status(404).json({ message: 'User not found' });

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) return res.status(400).json({ message: 'Incorrect current password' });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error changing password', error });
    }
  }

  static async getSessions(req: AuthRequest, res: Response) {
    try {
      const sessions = await Session.findAll({
        where: { userId: req.user.id, isActive: true },
        order: [['createdAt', 'DESC']]
      });
      res.json({ sessions, currentSessionId: req.user.sessionId });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching sessions', error });
    }
  }

  static async revokeSession(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const session = await Session.findOne({ where: { id, userId: req.user.id } });
      
      if (!session) return res.status(404).json({ message: 'Session not found' });
      
      session.isActive = false;
      await session.save();

      res.json({ message: 'Session revoked' });
    } catch (error) {
      res.status(500).json({ message: 'Error revoking session', error });
    }
  }

  static async revokeAllOtherSessions(req: AuthRequest, res: Response) {
    try {
      const currentSessionId = req.user.sessionId;
      const sessions = await Session.findAll({ where: { userId: req.user.id, isActive: true } });
      
      for (const session of sessions) {
        if (session.id !== currentSessionId) {
          session.isActive = false;
          await session.save();
        }
      }

      res.json({ message: 'All other sessions revoked' });
    } catch (error) {
      res.status(500).json({ message: 'Error revoking sessions', error });
    }
  }
}
