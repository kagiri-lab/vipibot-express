import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

class TwitterAccount extends Model {
  declare id: number;
  declare handle!: string;
  declare authMethod!: string;
  declare apiKey!: string;
  declare apiSecret!: string;
  declare bearerToken?: string;
  declare accessToken?: string;
  declare accessTokenSecret?: string;
  declare refreshToken?: string;
  declare isActive!: boolean;
  declare readonly createdAt!: Date;
  declare readonly updatedAt!: Date;
}

TwitterAccount.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    handle: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    authMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OAUTH1',
    },
    apiKey: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('apiKey');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('apiKey', value ? encrypt(value) : value);
      }
    },
    apiSecret: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('apiSecret');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('apiSecret', value ? encrypt(value) : value);
      }
    },
    bearerToken: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('bearerToken');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('bearerToken', value ? encrypt(value) : value);
      }
    },
    accessToken: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('accessToken');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('accessToken', value ? encrypt(value) : value);
      }
    },
    accessTokenSecret: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('accessTokenSecret');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('accessTokenSecret', value ? encrypt(value) : value);
      }
    },
    replyMode: {
      type: DataTypes.STRING,
      defaultValue: 'MANUAL',
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('refreshToken');
        return rawValue ? decrypt(rawValue) : rawValue;
      },
      set(value: string | null) {
        this.setDataValue('refreshToken', value ? encrypt(value) : value);
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'twitter_accounts',
    sequelize,
  }
);

export default TwitterAccount;
