import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class UserActivityLog extends Model {
  declare id: string;
  declare userId: string; // References User
  declare action: string; // e.g., 'REPLIED_TO_MENTION', 'REPLIED_TO_DM', 'UPDATED_SETTINGS'
  declare details: object;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

UserActivityLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  }
}, {
  sequelize,
  tableName: 'user_activity_logs',
});

export default UserActivityLog;
