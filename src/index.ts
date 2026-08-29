import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import sequelize from './config/database';
import cron from 'node-cron';
import { SyncController } from './controllers/SyncController';
import { CrawlerService } from './services/CrawlerService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    // Sync models with database (creates tables if they don't exist)
    // In production, use proper migrations (e.g. sequelize-cli) instead of sync()
    await sequelize.sync();
    console.log('Database synced.');

    // Setup automatic mention syncing (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      console.log('[CRON] Running automatic mention sync...');
      try {
        const res = await SyncController.runSync();
        console.log(`[CRON] Sync complete: ${res.totalNew} new mentions found.`);
      } catch (err) {
        console.error('[CRON] Sync failed:', err);
      }
    });

    // Setup automatic Knowledge Base crawler (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      console.log('[CRON] Running Knowledge Base crawler...');
      try {
        await CrawlerService.runCrawlingJob();
        console.log('[CRON] Crawler job finished.');
      } catch (err) {
        console.error('[CRON] Crawler failed:', err);
      }
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

startServer();
