const path = require('path');
const fs = require('fs');
require('dotenv').config();

const ROOT_DIR = path.resolve(__dirname, '..');
const IS_VERCEL = !!process.env.VERCEL;

// On Vercel serverless, root filesystem is read-only, only /tmp is writable
const BASE_WRITABLE_DIR = IS_VERCEL ? '/tmp' : ROOT_DIR;
const DATA_DIR = path.join(BASE_WRITABLE_DIR, 'data');
const UPLOADS_DIR = path.join(BASE_WRITABLE_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// If on Vercel and seed db exists in project, copy it to /tmp/data/db.json initially
if (IS_VERCEL) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const seedDB = path.join(ROOT_DIR, 'data', 'db.json');
  if (fs.existsSync(seedDB) && !fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(seedDB, DB_PATH);
    } catch (e) {}
  }
}

const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_PATH 
  ? path.resolve(ROOT_DIR, process.env.GOOGLE_CREDENTIALS_PATH)
  : path.join(BASE_WRITABLE_DIR, 'google-credentials.json');

module.exports = {
  PORT: process.env.PORT || 3000,
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  DB_PATH,
  CREDENTIALS_FILE,
  IS_VERCEL,
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123'
};
