import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class User extends Model {
  declare id: number;
  declare username!: string;
  declare email!: string;
  declare fullName!: string;
  declare passwordHash!: string;
  declare initials!: string;
  declare role!: string;
  declare readonly createdAt!: Date;
  declare readonly updatedAt!: Date;
}

User.init(
  {
    id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    initials: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'USER',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'users',
    sequelize,
  }
);

export default User;
