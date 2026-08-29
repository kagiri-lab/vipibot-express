import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { StatsController } from "../controllers/StatsController";
import { SettingsController } from "../controllers/SettingsController";
import { KnowledgeController } from "../controllers/KnowledgeController";
import { AgentController } from "../controllers/AgentController";
import { TwitterAccountController } from '../controllers/TwitterAccountController';
import { MentionController } from '../controllers/MentionController';
import { TweetController } from '../controllers/TweetController';
import { SyncController } from '../controllers/SyncController';
import { ReplyController } from '../controllers/ReplyController';
import { UserController } from '../controllers/UserController';
import { ProfileController } from '../controllers/ProfileController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRoles } from '../middlewares/roleMiddleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Ensure uploads directories exist
const knowledgeUploadsDir = path.join(process.cwd(), 'uploads', 'knowledge');
if (!fs.existsSync(knowledgeUploadsDir)) {
  fs.mkdirSync(knowledgeUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.path.includes('knowledge')) {
      cb(null, 'uploads/knowledge/');
    } else {
      cb(null, 'uploads/'); // fallback
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });


const router = Router();

// Auth
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);

// Profile
router.put('/profile/password', authMiddleware, ProfileController.changePassword);
router.get('/profile/sessions', authMiddleware, ProfileController.getSessions);
router.delete('/profile/sessions/:id', authMiddleware, ProfileController.revokeSession);
router.delete('/profile/sessions', authMiddleware, ProfileController.revokeAllOtherSessions);

// Stats Overview
router.get('/stats', authMiddleware, StatsController.getOverview);

// Users Management (Admin & Super Admin)
router.get('/users', authMiddleware, authorizeRoles('SUPER_ADMIN', 'ADMIN'), UserController.getAllUsers);
router.post('/users', authMiddleware, authorizeRoles('SUPER_ADMIN', 'ADMIN'), UserController.createUser);
router.get('/users/:id', authMiddleware, authorizeRoles('SUPER_ADMIN', 'ADMIN'), UserController.getUserDetails);
router.put('/users/:id', authMiddleware, authorizeRoles('SUPER_ADMIN', 'ADMIN'), UserController.updateUserStatus);
router.put('/users/:id/password', authMiddleware, authorizeRoles('SUPER_ADMIN', 'ADMIN'), UserController.adminChangePassword);

// Twitter Accounts (Super Admin Only)
router.get('/accounts', authMiddleware, authorizeRoles('SUPER_ADMIN'), TwitterAccountController.getAll);
router.get('/accounts/:id', authMiddleware, authorizeRoles('SUPER_ADMIN'), TwitterAccountController.getById);
router.post('/accounts', authMiddleware, authorizeRoles('SUPER_ADMIN'), TwitterAccountController.create);
router.put('/accounts/:id', authMiddleware, authorizeRoles('SUPER_ADMIN'), TwitterAccountController.update);
router.delete('/accounts/:id', authMiddleware, authorizeRoles('SUPER_ADMIN'), TwitterAccountController.delete);

// Tweets (Broadcast and Reply)
router.post('/tweets', authMiddleware, upload.single('media'), TweetController.postTweet);


// Mentions (All authenticated users)
router.get('/mentions', authMiddleware, MentionController.getAll);
router.post('/mentions/sync', authMiddleware, SyncController.syncMentions);

// Replies (All authenticated users)
router.post('/replies', authMiddleware, ReplyController.postReply);

// Settings Routes
router.get('/settings', authMiddleware, SettingsController.getSettings);
router.post('/settings', authMiddleware, SettingsController.saveSettings);

// Knowledge Base Routes
router.get('/knowledge', authMiddleware, KnowledgeController.getDocuments);
router.post('/knowledge', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), KnowledgeController.addDocument);
router.post('/knowledge/text', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), KnowledgeController.addText);
router.post('/knowledge/upload', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), upload.array('files', 10), KnowledgeController.uploadDocument);
router.delete('/knowledge/:id', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), KnowledgeController.deleteDocument);
router.post('/knowledge/crawl', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), KnowledgeController.forceCrawl);

// Agent Playground
router.post('/agent/chat', authMiddleware, authorizeRoles('ADMIN', 'SUPER_ADMIN'), AgentController.chat);

export default router;
