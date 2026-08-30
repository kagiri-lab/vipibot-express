import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class AIAuditLog extends Model {
  declare id!: string;
  declare provider!: string;
  declare modelUsed!: string;
  declare promptText!: string;
  declare responseText!: string;
  declare status!: 'SUCCESS' | 'ERROR';
  declare errorMessage?: string;
  declare readonly createdAt!: Date;
  declare readonly updatedAt!: Date;
}

AIAuditLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  modelUsed: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  promptText: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  responseText: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'ERROR'),
    defaultValue: 'SUCCESS',
    allowNull: false,
  },
  errorMessage: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  }
}, {
  sequelize,
  tableName: 'ai_audit_logs',
});

export default AIAuditLog;
