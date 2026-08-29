import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { username, password, initials } = req.body;
      
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ username, passwordHash, initials });

      res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
      res.status(500).json({ message: 'Error registering user', error });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is disabled. Contact your administrator.' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const tokenStr = require('crypto').randomBytes(16).toString('hex');
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Create session in DB
      const { Session } = require('../models');
      const session = await Session.create({
        userId: user.id,
        tokenStr,
        ipAddress,
        userAgent,
        isActive: true
      });

      const token = jwt.sign(
        { id: user.id, username: user.username, initials: user.initials, role: user.role, sessionId: session.id },
        process.env.JWT_SECRET || 'super_secret_jwt_key_here',
        { expiresIn: '1d' }
      );

      res.json({ token, user: { id: user.id, username: user.username, initials: user.initials, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error logging in', error });
    }
  }
}
