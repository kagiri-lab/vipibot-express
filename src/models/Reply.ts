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
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    mentionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
