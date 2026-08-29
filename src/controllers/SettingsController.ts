import { Request, Response } from 'express';
import { SystemSetting, KnowledgeDocument } from '../models';

export class SettingsController {
  static async getSettings(req: Request, res: Response) {
    try {
      const settings = await SystemSetting.findAll();
      const config = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching settings', error });
    }
  }

  static async saveSettings(req: Request, res: Response) {
    try {
      const updates = req.body;
      let vectorDbChanged = false;

      // Check if vector_db_provider is changing
      if (updates.vector_db_provider) {
        const currentProvider = await SystemSetting.findOne({ where: { key: 'vector_db_provider' } });
        if (currentProvider && currentProvider.value !== updates.vector_db_provider) {
          vectorDbChanged = true;
        }
      }

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
           await SystemSetting.upsert({
             key,
             value: value === null ? '' : String(value)
           });
        }
      }

      // If Vector DB changed, reset all KnowledgeDocuments to PENDING to trigger a re-index
      if (vectorDbChanged) {
        await KnowledgeDocument.update(
          { status: 'PENDING', lastIndexedAt: null },
          { where: {} }
        );
      }

      res.json({ message: 'Settings updated successfully', reindexTriggered: vectorDbChanged });
    } catch (error) {
      res.status(500).json({ message: 'Error updating settings', error });
    }
  }
}
