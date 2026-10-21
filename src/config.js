const path = require('path');
require('dotenv').config();

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_PATH 
  ? path.resolve(ROOT_DIR, process.env.GOOGLE_CREDENTIALS_PATH)
  : path.join(ROOT_DIR, 'google-credentials.json');

module.exports = {
  PORT: process.env.PORT || 3000,
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  DB_PATH,
  CREDENTIALS_FILE,
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123'
};
