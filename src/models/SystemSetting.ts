import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

class SystemSetting extends Model {
  declare key: string;
  declare value: string | null;
}

SystemSetting.init(
  {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('value');
        const key = this.getDataValue('key');
        const sensitiveKeys = ['openai_key', 'anthropic_key', 'gemini_key'];
        
        if (rawValue && sensitiveKeys.includes(key)) {
          return decrypt(rawValue);
        }
        return rawValue;
      },
      set(val: string | null) {
        const key = this.getDataValue('key') || (this as any).key;
        const sensitiveKeys = ['openai_key', 'anthropic_key', 'gemini_key'];
        
        if (val && sensitiveKeys.includes(key)) {
          this.setDataValue('value', encrypt(val));
        } else {
          this.setDataValue('value', val);
        }
      }
    },
  },
  {
    sequelize,
    tableName: 'system_settings',
    timestamps: true,
  }
);

export default SystemSetting;
