import User from './User';
import TwitterAccount from './TwitterAccount';
import Mention from './Mention';
import Reply from './Reply';
import Session from './Session';
import SystemSetting from './SystemSetting';
import KnowledgeDocument from './KnowledgeDocument';
import AIAuditLog from './AIAuditLog';

// Associations
TwitterAccount.hasMany(Mention, { foreignKey: 'twitterAccountId', as: 'mentions' });
Mention.belongsTo(TwitterAccount, { foreignKey: 'twitterAccountId', as: 'twitterAccount' });

Mention.hasOne(Reply, { foreignKey: 'mentionId', as: 'reply' });
Reply.belongsTo(Mention, { foreignKey: 'mentionId', as: 'mention' });

User.hasMany(Reply, { foreignKey: 'userId', as: 'replies' });
Reply.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  TwitterAccount,
  Mention,
  Reply,
  Session,
  SystemSetting,
  KnowledgeDocument,
  AIAuditLog
};


