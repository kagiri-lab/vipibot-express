import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class Session extends Model {
  declare id: number;
  declare userId: number;
  declare tokenStr: string; // Store a portion or hash of token for identification
  declare ipAddress: string;
  declare userAgent: string;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Session.init(
  {
    id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
    userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
    tokenStr: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'sessions',
    sequelize,
  }
);

export default Session;
