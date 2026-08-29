import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class KnowledgeDocument extends Model {
  declare id: number;
  declare url: string;
  declare title: string | null;
  declare status: 'PENDING' | 'CRAWLING' | 'INDEXED' | 'FAILED';
  declare lastIndexedAt: Date | null;
}

KnowledgeDocument.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'CRAWLING', 'INDEXED', 'FAILED'),
      defaultValue: 'PENDING',
    },
    lastIndexedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'knowledge_documents',
    timestamps: true,
  }
);

export default KnowledgeDocument;
