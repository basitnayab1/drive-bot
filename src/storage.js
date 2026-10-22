const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure directories exist
if (!fs.existsSync(config.DATA_DIR)) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}
if (!fs.existsSync(config.UPLOADS_DIR)) {
  fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });
}

function loadDB() {
  if (!fs.existsSync(config.DB_PATH)) {
    const initialData = {
      links: [],
      uploads: [],
      settings: {
        googleDriveFolderId: config.GOOGLE_DRIVE_FOLDER_ID || '',
        credentialsFileFound: fs.existsSync(config.CREDENTIALS_FILE)
      }
    };
    fs.writeFileSync(config.DB_PATH, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const content = fs.readFileSync(config.DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading DB, re-initializing:', err);
    return { links: [], uploads: [], settings: {} };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(config.DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

// Helpers for links
function getAllLinks() {
  const db = loadDB();
  const now = new Date();
  
  // Check if any link with expiresAt has passed and update status to expired automatically
  let changed = false;
  db.links.forEach(link => {
    if (link.status === 'active' && link.expiresAt) {
      if (new Date(link.expiresAt) <= now) {
        link.status = 'expired';
        link.expiredReason = 'auto_time_limit';
        changed = true;
      }
    }
  });

  if (changed) {
    saveDB(db);
  }

  return db.links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getLinkById(id) {
  const links = getAllLinks();
  return links.find(l => l.id === id);
}

function createLink(linkData) {
  const db = loadDB();
  const newLink = {
    id: linkData.id || require('crypto').randomBytes(4).toString('hex'), // e.g. "a3b9f10c"
    title: linkData.title || 'Client Upload',
    clientName: linkData.clientName || '',
    destinationFolder: linkData.destinationFolder || '',
    status: 'active', // active or expired
    createdAt: new Date().toISOString(),
    expiresAt: linkData.expiresAt || null,
    maxFileSizeMB: parseInt(linkData.maxFileSizeMB, 10) || 500,
    allowedExtensions: linkData.allowedExtensions || '',
    notes: linkData.notes || '',
    uploadCount: 0,
    totalBytes: 0
  };

  db.links.unshift(newLink);
  saveDB(db);
  return newLink;
}

function updateLinkStatus(id, newStatus) {
  const db = loadDB();
  const link = db.links.find(l => l.id === id);
  if (!link) return null;

  link.status = newStatus;
  link.updatedAt = new Date().toISOString();
  if (newStatus === 'expired') {
    link.expiredAt = new Date().toISOString();
    link.expiredReason = 'manual';
  } else if (newStatus === 'active') {
    // If reactivated and expiresAt was in the past, clear it or extend it
    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
      link.expiresAt = null;
    }
  }
  saveDB(db);
  return link;
}

function deleteLink(id) {
  const db = loadDB();
  const idx = db.links.findIndex(l => l.id === id);
  if (idx === -1) return false;
  db.links.splice(idx, 1);
  saveDB(db);
  return true;
}

// Helpers for uploads
function recordUpload(uploadData) {
  const db = loadDB();
  const newUpload = {
    id: uploadData.id || require('crypto').randomBytes(6).toString('hex'),
    linkId: uploadData.linkId,
    linkTitle: uploadData.linkTitle || '',
    clientName: uploadData.clientName || '',
    fileName: uploadData.fileName,
    fileSize: uploadData.fileSize,
    mimeType: uploadData.mimeType,
    uploadedAt: new Date().toISOString(),
    driveFileId: uploadData.driveFileId || null,
    driveWebViewLink: uploadData.driveWebViewLink || null,
    localPath: uploadData.localPath || null,
    status: uploadData.status || 'saved_locally' // 'synced' or 'saved_locally'
  };

  db.uploads.unshift(newUpload);

  // Update link stats
  const link = db.links.find(l => l.id === uploadData.linkId);
  if (link) {
    link.uploadCount = (link.uploadCount || 0) + 1;
    link.totalBytes = (link.totalBytes || 0) + uploadData.fileSize;
  }

  saveDB(db);
  return newUpload;
}

function updateUpload(id, updates) {
  const db = loadDB();
  const upload = db.uploads.find(u => u.id === id);
  if (!upload) return null;
  Object.assign(upload, updates);
  saveDB(db);
  return upload;
}

function getAllUploads() {
  const db = loadDB();
  return db.uploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function getUploadsByLinkId(linkId) {
  const db = loadDB();
  return db.uploads
    .filter(u => u.linkId === linkId)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function getSettings() {
  const db = loadDB();
  return {
    ...db.settings,
    credentialsFileFound: fs.existsSync(config.CREDENTIALS_FILE),
    credentialsPath: config.CREDENTIALS_FILE,
    defaultFolderId: db.settings?.googleDriveFolderId || config.GOOGLE_DRIVE_FOLDER_ID
  };
}

function updateSettings(settings) {
  const db = loadDB();
  db.settings = { ...db.settings, ...settings };
  saveDB(db);
  return getSettings();
}

module.exports = {
  getAllLinks,
  getLinkById,
  createLink,
  updateLinkStatus,
  deleteLink,
  recordUpload,
  updateUpload,
  getAllUploads,
  getUploadsByLinkId,
  getSettings,
  updateSettings
};
