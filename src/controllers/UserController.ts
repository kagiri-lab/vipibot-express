import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Session } from '../models';

export class UserController {
  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await User.findAll({ attributes: ['id', 'username', 'initials', 'role', 'isActive', 'createdAt'] });
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error });
    }
  }

  static async getUserDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, { attributes: ['id', 'username', 'initials', 'role', 'isActive', 'createdAt'] });
      
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Get last session
      const lastSession = await Session.findOne({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['createdAt', 'ipAddress', 'userAgent']
      });

      res.json({ user, lastSession });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user details', error });
    }
  }

  static async updateUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isActive, role } = req.body;
      const user = await User.findByPk(id);
      
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      // Don't let someone disable themselves
      const requestingUserId = (req as any).user.id;
      if (user.id === requestingUserId && isActive === false) {
        return res.status(400).json({ message: 'You cannot disable your own account' });
      }

      if (isActive !== undefined) user.isActive = isActive;
      if (role && ['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
        user.role = role;
      }
      
      await user.save();

      // If disabled, revoke all active sessions
      if (isActive === false) {
        await Session.update({ isActive: false }, { where: { userId: user.id } });
      }

      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Error updating user', error });
    }
  }

  static async adminChangePassword(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const user = await User.findByPk(id);
      
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;
      await user.save();

      // Revoke sessions since password changed
      await Session.update({ isActive: false }, { where: { userId: user.id } });

      res.json({ message: 'User password changed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error changing password', error });
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const { username, password, initials, role } = req.body;
      
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Ensure that only valid roles are assigned
      const assignedRole = ['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role) ? role : 'USER';

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ username, passwordHash, initials, role: assignedRole });

      res.status(201).json({ message: 'User created successfully', user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      res.status(500).json({ message: 'Error creating user', error });
    }
  }
}
