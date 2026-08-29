import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const initializeDatabase = async () => {
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

  try {
    console.log(`Connecting to MySQL at ${DB_HOST} with user ${DB_USER}...`);
    // Connect without database to create it
    const connection = await mysql.createConnection({
      host: DB_HOST || '127.0.0.1',
      user: DB_USER || 'root',
      password: DB_PASS || '',
    });

    const dbName = DB_NAME || 'vipi_twitter';
    console.log(`Ensuring database '${dbName}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`Database '${dbName}' is ready.`);
    
    await connection.end();

    // Now initialize Sequelize to sync tables
    console.log('Syncing models with the database...');
    // Dynamically import to ensure env variables are loaded before Sequelize initializes
    const { default: sequelize } = await import('../src/config/database');
    await import('../src/models'); // Load models

    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    
    console.log('Migrations complete. Database is fully set up!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

initializeDatabase();
