import { Request, Response } from 'express';
import { DirectMessage, TwitterAccount } from '../models';
import { TwitterService } from '../services/TwitterService';
import { AgentService } from '../services/AgentService';

export class DmController {
  
  
  static async getAutoReplySetting(req: Request, res: Response) {
    try {
      const { SystemSetting } = require('../models');
      const setting = await SystemSetting.findOne({ where: { key: 'dm_auto_reply_enabled' } });
      res.json({ enabled: setting?.value === 'true' });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  }

  static async setAutoReplySetting(req: Request, res: Response) {
    try {
      const { SystemSetting } = require('../models');
      const { enabled } = req.body;
      const [setting, created] = await SystemSetting.findOrCreate({
        where: { key: 'dm_auto_reply_enabled' },
        defaults: { value: enabled ? 'true' : 'false' }
      });
      if (!created) {
        await setting.update({ value: enabled ? 'true' : 'false' });
      }
      res.json({ success: true, enabled });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  }

  static async syncConversations(req: Request, res: Response) {
    try {
      const { accountId } = req.body;
      if (!accountId) return res.status(400).json({ error: 'Missing accountId' });
      
      const events = await TwitterService.syncDMs(accountId);
      
      let newCount = 0;
      const client = await TwitterService.getClient(accountId);
      const meReq = await client.v2.me();
      const myId = meReq.data.id;

      for (const event of events) {
         if (event.event_type === 'MessageCreate') {
            const senderId = event.sender_id;
            // Parse recipient from dm_conversation_id (e.g. "user1-user2")
            let targetId = myId;
            if (event.dm_conversation_id) {
               const parts = event.dm_conversation_id.split('-');
               targetId = parts[0] === senderId ? parts[1] : parts[0];
            }
            
            const text = event.text;
            const eventId = event.id;
            const createdAt = event.created_at ? new Date(event.created_at) : new Date();
            
            // Check if exists
            const exists = await DirectMessage.findOne({ where: { twitterEventId: eventId } });
            if (!exists) {
               await DirectMessage.create({
                 twitterEventId: eventId,
                 ownerAccountId: accountId,
                 senderTwitterId: senderId,
                 recipientTwitterId: targetId,
                 text,
                 participantHandle: userMap.get(targetId) || targetId,
                 isFromUs: senderId === myId,
                 status: senderId === myId ? 'REPLIED' : 'UNREAD',
                 createdAt
               });
               newCount++;
            }
         }
      }
      
      res.json({ message: 'Sync complete', count: newCount });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  static async getConversations(req: Request, res: Response) {
    try {
      // Group by senderTwitterId
      const dms = await DirectMessage.findAll({
        order: [['createdAt', 'DESC']]
      });
      
      const convos = new Map();
      dms.forEach(dm => {
        const otherId = dm.isFromUs ? dm.recipientTwitterId : dm.senderTwitterId;
        if (!convos.has(otherId)) {
          convos.set(otherId, {
            participantId: otherId,
            participantHandle: dm.participantHandle || otherId,
            lastMessage: dm.text,
            lastMessageAt: dm.createdAt,
            unreadCount: dm.status === 'UNREAD' && !dm.isFromUs ? 1 : 0
          });
        } else {
          if (dm.status === 'UNREAD' && !dm.isFromUs) {
             convos.get(otherId).unreadCount++;
          }
        }
      });
      
      res.json(Array.from(convos.values()));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getConversationMessages(req: Request, res: Response) {
    try {
      const { participantId } = req.params;
      const dms = await DirectMessage.findAll({
        where: { senderTwitterId: participantId },
        order: [['createdAt', 'ASC']]
      });
      
      const outgoingDms = await DirectMessage.findAll({
         where: { recipientTwitterId: participantId },
         order: [['createdAt', 'ASC']]
      });
      
      const all = [...dms, ...outgoingDms].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      // Mark as read
      await DirectMessage.update({ status: 'REPLIED' }, { where: { senderTwitterId: participantId, status: 'UNREAD' }});
      
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async sendReply(req: Request, res: Response) {
    try {
      const { participantId, text, accountId } = req.body;
      if (!participantId || !text || !accountId) return res.status(400).json({ error: 'Missing params' });
      
      await TwitterService.sendDM(accountId, participantId, text);
      
      // Save locally
      const saved = await DirectMessage.create({
        twitterEventId: 'out_' + Date.now().toString(),
        ownerAccountId: accountId,
        senderTwitterId: 'us',
        recipientTwitterId: participantId,
        text,
        isFromUs: true,
        status: 'REPLIED'
      });
      
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
