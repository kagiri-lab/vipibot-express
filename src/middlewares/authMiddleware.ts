import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_here');
      
      const { Session } = require('../models');
      if (decoded.sessionId) {
        const session = await Session.findByPk(decoded.sessionId);
        if (!session || !session.isActive) {
          return res.status(401).json({ message: 'Session expired or revoked' });
        }
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  } else {
    res.status(401).json({ message: 'Authorization header missing' });
  }
};
