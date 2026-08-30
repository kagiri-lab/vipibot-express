import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class Mention extends Model {
  declare id: number;
  declare twitterAccountId!: number;
  declare tweetId!: string;
  declare authorUsername!: string;
  declare text!: string;
  declare parentTweetId!: string | null;
  declare parentTweetText!: string | null;
  declare conversationId!: string | null;
  declare rootTweetText!: string | null;
  declare draftText!: string | null;
  declare status!: 'PENDING' | 'REPLIED';
  declare readonly createdAt!: Date;
  declare readonly updatedAt!: Date;
}

Mention.init(
  {
    id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
    twitterAccountId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
    tweetId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // A tweet is fetched once
    },
    authorUsername: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    parentTweetId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentTweetText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conversationId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    authorProfileImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaUrls: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    rootTweetText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    draftText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'REPLIED'),
      defaultValue: 'PENDING',
    },
  },
  {
    tableName: 'mentions',
    sequelize,
  }
);

export default Mention;
