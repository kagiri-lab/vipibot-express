import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { TwitterAccount } from './TwitterAccount';

interface TargetAccountAttributes {
  id: string;
  handle: string;
  twitterId: string;
  ownerAccountId: string;
  lastProcessedTweetId: string | null;
  isActive: boolean;
  tone: string | null;
}

interface TargetAccountCreationAttributes extends Optional<TargetAccountAttributes, 'id' | 'lastProcessedTweetId' | 'isActive' | 'tone'> {}

export class TargetAccount extends Model<TargetAccountAttributes, TargetAccountCreationAttributes> implements TargetAccountAttributes {
  declare id: string;
  declare handle: string;
  declare twitterId: string;
  declare ownerAccountId: string;
  declare lastProcessedTweetId: string | null;
  declare isActive: boolean;
  declare tone: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TargetAccount.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  handle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  twitterId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ownerAccountId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  lastProcessedTweetId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  tone: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  sequelize,
  tableName: 'target_accounts',
});

// Relationships


