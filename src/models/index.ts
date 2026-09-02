import User from './User';
import TwitterAccount from './TwitterAccount';
import Mention from './Mention';
import Reply from './Reply';
import Session from './Session';
import SystemSetting from './SystemSetting';
import KnowledgeDocument from './KnowledgeDocument';
import AIAuditLog from './AIAuditLog';
import UserActivityLog from './UserActivityLog';
import { TargetAccount } from './TargetAccount';
import { DirectMessage } from './DirectMessage';

// Associations
TwitterAccount.hasMany(Mention, { foreignKey: 'twitterAccountId', as: 'mentions' });
Mention.belongsTo(TwitterAccount, { foreignKey: 'twitterAccountId', as: 'twitterAccount' });

Mention.hasOne(Reply, { foreignKey: 'mentionId', as: 'reply' });
Reply.belongsTo(Mention, { foreignKey: 'mentionId', as: 'mention' });

User.hasMany(Reply, { foreignKey: 'userId', as: 'replies' });
Reply.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

TwitterAccount.hasMany(TargetAccount, { foreignKey: 'ownerAccountId' });
TargetAccount.belongsTo(TwitterAccount, { foreignKey: 'ownerAccountId' });

TwitterAccount.hasMany(DirectMessage, { foreignKey: 'ownerAccountId' });
DirectMessage.belongsTo(TwitterAccount, { foreignKey: 'ownerAccountId' });

User.hasMany(UserActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
UserActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  TwitterAccount,
  Mention,
  Reply,
  Session,
  SystemSetting,
  KnowledgeDocument,
  AIAuditLog,
  UserActivityLog,
  TargetAccount,
  DirectMessage
};
