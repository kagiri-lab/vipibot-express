import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class Reply extends Model {
  declare id: number;
  declare mentionId!: number;
  declare userId!: number;
  declare replyText!: string;
  declare sentAt!: Date;
  declare readonly createdAt!: Date;
  declare readonly updatedAt!: Date;
}

Reply.init(
  {
    id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
    mentionId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
    userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
    replyText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'replies',
    sequelize,
  }
);

export default Reply;
