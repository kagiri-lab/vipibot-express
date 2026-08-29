import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Make sure key is exactly 32 bytes (256 bits)
const getHashKey = () => {
  return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
};

export const encrypt = (text: string): string => {
  if (!text) return text;
  // If already encrypted (starts with enc:), don't encrypt again
  if (text.startsWith('enc:')) return text;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getHashKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return 'enc:' + iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed', err);
    return text; // Fallback to plain text on error
  }
};

export const decrypt = (text: string): string => {
  if (!text) return text;
  // If not encrypted, return as is
  if (!text.startsWith('enc:')) return text;
  
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[1] || '', 'hex');
    const encryptedText = parts[2] || '';
    const decipher = crypto.createDecipheriv(ALGORITHM, getHashKey(), iv);
    let decrypted = decipher.update(encryptedText as string, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed', err);
    return text;
  }
};
