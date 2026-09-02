import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { TwitterAccount } from './TwitterAccount';

interface DirectMessageAttributes {
  id: string;
  twitterEventId: string;
  ownerAccountId: string;
  senderTwitterId: string;
  recipientTwitterId: string;
  text: string;
  isFromUs: boolean;
  status: 'UNREAD' | 'REPLIED' | 'AUTO_REPLIED';
  participantHandle?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface DirectMessageCreationAttributes extends Optional<DirectMessageAttributes, 'id' | 'status'> {}

export class DirectMessage extends Model<DirectMessageAttributes, DirectMessageCreationAttributes> implements DirectMessageAttributes {
  declare id: string;
  declare twitterEventId: string;
  declare ownerAccountId: string;
  declare senderTwitterId: string;
  declare recipientTwitterId: string;
  declare text: string;
  declare isFromUs: boolean;
  declare status: 'UNREAD' | 'REPLIED' | 'AUTO_REPLIED';
  declare participantHandle: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

DirectMessage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  twitterEventId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  ownerAccountId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  senderTwitterId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recipientTwitterId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isFromUs: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('UNREAD', 'REPLIED', 'AUTO_REPLIED'),
    allowNull: false,
    defaultValue: 'UNREAD'
  },
  participantHandle: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'DirectMessage',
  timestamps: true
});
