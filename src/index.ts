import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import sequelize from './config/database';
import cron from 'node-cron';
import { SyncController } from './controllers/SyncController';
import { SystemSetting } from './models';
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

    // Setup automatic mention syncing (dynamically polled every minute)
    let lastMentionSyncTime = 0;
    cron.schedule('* * * * *', async () => {
      try {
        const setting = await SystemSetting.findOne({ where: { key: 'sync_interval_minutes' }});
        const intervalMins = parseInt(setting?.value || '5', 10);
        const now = Date.now();
        
        // If the interval has passed since the last sync
        if (now - lastMentionSyncTime >= intervalMins * 60 * 1000) {
          lastMentionSyncTime = now; // update timer immediately to prevent duplicate runs
          console.log(`[CRON] Running automatic mention sync (Interval: ${intervalMins}m)...`);
          const res = await SyncController.runSync();
          console.log(`[CRON] Sync complete: ${res.totalNew} new mentions found.`);
        }
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
