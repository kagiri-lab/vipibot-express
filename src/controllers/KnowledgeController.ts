import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { KnowledgeDocument } from '../models';

export class KnowledgeController {
  // Force Crawler Job
  static async forceCrawl(req: Request, res: Response) {
    try {
      const { CrawlerService } = require('../services/CrawlerService');
      // Trigger asynchronously so we don't block the HTTP response
      CrawlerService.runCrawlingJob().catch(console.error);
      res.json({ message: 'Crawling job triggered successfully.' });
    } catch (error: any) {
      console.error('Error triggering crawl:', error);
      res.status(500).json({ message: error.message || 'Error triggering crawl' });
    }
  }

  static async getDocuments(req: Request, res: Response) {
    try {
      const documents = await KnowledgeDocument.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching documents', error });
    }
  }

  static async addDocument(req: Request, res: Response) {
    try {
      const { url } = req.body;
      
      const doc = await KnowledgeDocument.create({ url, status: 'PENDING' });
      
      res.status(201).json({ message: 'Document added to queue', document: doc });
    } catch (error: any) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'URL is already in the knowledge base.' });
      }
      res.status(500).json({ message: 'Error adding document', error });
    }
  }

  static async uploadDocument(req: Request, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const docs = [];
      for (const file of files) {
        const localUrl = `local://${file.path}`;
        const title = file.originalname;

        try {
          const doc = await KnowledgeDocument.create({ 
            url: localUrl, 
            title: title,
            status: 'PENDING' 
          });
          docs.push(doc);
        } catch (dbErr: any) {
          if (dbErr.name !== 'SequelizeUniqueConstraintError') {
             console.error('Error saving file doc:', dbErr);
          }
        }
      }

      res.status(201).json({ message: `${docs.length} files uploaded and added to queue`, documents: docs });
    } catch (error: any) {
      res.status(500).json({ message: 'Error uploading documents', error });
    }
  }

  static async deleteDocument(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const doc = await KnowledgeDocument.findByPk(id);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (doc.url.startsWith('local://')) {
        const fs = require('fs');
        const path = doc.url.replace('local://', '');
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      }
      
      await doc.destroy();
      
      // Force a full re-index to cleanly wipe the vector store
      const { SystemSetting } = require('../models');
      const settings = await SystemSetting.findAll();
      const config = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      if (config.vector_db_provider === 'HNSWLIB') {
        const path = require('path');
        const vectorStorePath = path.join(process.cwd(), 'vector_store');
        const fs = require('fs');
        if (fs.existsSync(vectorStorePath)) {
          fs.rmSync(vectorStorePath, { recursive: true, force: true });
        }
      }
      // Clear in-memory cache
      const { CrawlerService } = require('../services/CrawlerService');
      CrawlerService.clearVectorStoreCache();

      // Set all remaining documents to PENDING
      await KnowledgeDocument.update({ status: 'PENDING' }, { where: {} });
      
      res.json({ message: 'Document removed and Vector DB scheduled for clean rebuild' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting document', error });
    }
  }

  static async addText(req: Request, res: Response) {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
      }

      const uploadDir = path.join(process.cwd(), 'uploads/knowledge');
      const fs = require('fs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `text_${crypto.randomBytes(8).toString('hex')}.txt`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, content, 'utf8');

      const doc = await KnowledgeDocument.create({
        title: title,
        url: 'local://' + filePath,
        status: 'PENDING'
      });

      res.status(201).json(doc);
    } catch (error: any) {
      console.error('Error adding text:', error);
      res.status(500).json({ message: error.message || 'Error adding text document' });
    }
  }

}
