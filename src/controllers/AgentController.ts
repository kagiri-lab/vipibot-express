import { Request, Response } from 'express';
import { AgentService } from '../services/AgentService';

export class AgentController {
  static async chat(req: Request, res: Response) {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      // Re-use the exact same logic VipiBot uses for tweets to provide an accurate test
      const reply = await AgentService.generateReply(message);
      
      res.json({ reply });
    } catch (error: any) {
      console.error('Agent chat error:', error);
      res.status(500).json({ message: error.message || 'Error communicating with Agent' });
    }
  }
}
