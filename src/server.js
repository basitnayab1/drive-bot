const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const config = require('./config');
const storage = require('./storage');
const driveService = require('./driveService');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure Multer for local temp storage before Google Drive upload
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Keep safe filename with timestamp
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e5);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit max per file
  }
});

// ==================== ROUTES ====================

// Client Upload Page route: /u/:id or /upload/:id
app.get(['/u/:id', '/upload/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'upload.html'));
});

// Admin Dashboard route
app.get(['/', '/admin'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API: Overall Status & Analytics
app.get('/api/status', async (req, res) => {
  const links = storage.getAllLinks();
  const uploads = storage.getAllUploads();
  const driveStatus = await driveService.testConnection();

  const activeLinks = links.filter(l => l.status === 'active');
  const expiredLinks = links.filter(l => l.status === 'expired');
  const totalBytes = uploads.reduce((acc, u) => acc + (u.fileSize || 0), 0);

  res.json({
    totalLinks: links.length,
    activeLinksCount: activeLinks.length,
    expiredLinksCount: expiredLinks.length,
    totalUploadsCount: uploads.length,
    totalBytesUploaded: totalBytes,
    googleDrive: driveStatus,
    settings: storage.getSettings()
  });
});

// API: Get all links
app.get('/api/links', (req, res) => {
  const links = storage.getAllLinks();
  res.json({ links });
});

// API: Create a new shareable link
app.post('/api/links', (req, res) => {
  try {
    const { title, clientName, destinationFolder, expiresAt, maxFileSizeMB, allowedExtensions, notes } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required for the upload link.' });
    }

    const newLink = storage.createLink({
      title: title.trim(),
      clientName: clientName ? clientName.trim() : '',
      destinationFolder: destinationFolder ? destinationFolder.trim() : '',
      expiresAt: expiresAt || null,
      maxFileSizeMB: maxFileSizeMB || 500,
      allowedExtensions: allowedExtensions ? allowedExtensions.trim() : '',
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({ success: true, link: newLink });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Toggle link status (Active <-> Expired)
app.post('/api/links/:id/toggle', (req, res) => {
  const { id } = req.params;
  const link = storage.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const newStatus = link.status === 'active' ? 'expired' : 'active';
  const updated = storage.updateLinkStatus(id, newStatus);
  res.json({ success: true, link: updated });
});

// API: Expire link immediately
app.post('/api/links/:id/expire', (req, res) => {
  const { id } = req.params;
  const link = storage.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const updated = storage.updateLinkStatus(id, 'expired');
  res.json({ success: true, link: updated, message: 'Link has been successfully expired.' });
});

// API: Activate link
app.post('/api/links/:id/activate', (req, res) => {
  const { id } = req.params;
  const link = storage.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const updated = storage.updateLinkStatus(id, 'active');
  res.json({ success: true, link: updated, message: 'Link has been successfully activated.' });
});

// API: Delete link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  const success = storage.deleteLink(id);
  if (!success) {
    return res.status(404).json({ error: 'Link not found' });
  }
  res.json({ success: true, message: 'Link deleted' });
});

// API: Get link details for client upload page (Public)
app.get('/api/public/link/:id', (req, res) => {
  const { id } = req.params;
  const link = storage.getLinkById(id);

  if (!link) {
    return res.status(404).json({ 
      valid: false, 
      error: 'Upload link not found. It may have been deleted.' 
    });
  }

  // Check expiration
  const isExpired = Boolean(link.status === 'expired' || (link.expiresAt && new Date(link.expiresAt) <= new Date()));

  res.json({
    valid: true,
    id: link.id,
    title: link.title,
    clientName: link.clientName,
    isExpired: isExpired,
    status: isExpired ? 'expired' : 'active',
    expiresAt: link.expiresAt,
    maxFileSizeMB: link.maxFileSizeMB,
    allowedExtensions: link.allowedExtensions,
    notes: link.notes
  });
});

// API: Handle file upload from client
app.post('/api/upload/:id', upload.array('files', 20), async (req, res) => {
  const { id } = req.params;
  const link = storage.getLinkById(id);

  if (!link) {
    // Clean up uploaded files if link is invalid
    if (req.files) {
      req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    }
    return res.status(404).json({ error: 'Invalid upload link.' });
  }

  // Check if link is active or expired
  if (link.status === 'expired' || (link.expiresAt && new Date(link.expiresAt) <= new Date())) {
    if (req.files) {
      req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    }
    return res.status(403).json({ 
      error: 'This upload link has expired. You cannot upload files through this link anymore.' 
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const results = [];
  const driveAvailable = driveService.getDriveClient() !== null;

  for (const file of req.files) {
    let driveFile = null;
    let uploadStatus = 'saved_locally';

    try {
      if (driveAvailable) {
        // Upload directly to Google Drive (in client/destination folder if specified)
        const subfolder = link.destinationFolder || link.clientName || null;
        driveFile = await driveService.uploadToGoogleDrive(
          file.path,
          file.originalname,
          file.mimetype,
          subfolder
        );
        uploadStatus = 'synced';
        
        // Remove local temporary file once uploaded to Google Drive
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (delErr) {
          console.warn('Could not remove temp file:', delErr.message);
        }
      }
    } catch (uploadErr) {
      console.error(`Google Drive upload failed for ${file.originalname}:`, uploadErr.message);
      // Keep file locally as fallback
      uploadStatus = 'saved_locally';
    }

    const record = storage.recordUpload({
      linkId: link.id,
      linkTitle: link.title,
      clientName: link.clientName,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      driveFileId: driveFile?.id || null,
      driveWebViewLink: driveFile?.webViewLink || null,
      localPath: uploadStatus === 'saved_locally' ? file.path : null,
      status: uploadStatus
    });

    results.push({
      fileName: file.originalname,
      size: file.size,
      status: uploadStatus,
      driveLink: driveFile?.webViewLink || null
    });
  }

  res.json({
    success: true,
    message: `${results.length} file(s) uploaded successfully!`,
    syncedToDrive: results.every(r => r.status === 'synced'),
    files: results
  });
});

// API: Get all uploads list
app.get('/api/uploads', (req, res) => {
  const uploads = storage.getAllUploads();
  res.json({ uploads });
});

// API: Re-attempt syncing locally saved files to Google Drive
app.post('/api/sync-pending', async (req, res) => {
  const uploads = storage.getAllUploads();
  const pending = uploads.filter(u => u.status === 'saved_locally' && u.localPath && fs.existsSync(u.localPath));

  if (pending.length === 0) {
    return res.json({ success: true, message: 'No pending local files to sync.', syncedCount: 0 });
  }

  let syncedCount = 0;
  for (const item of pending) {
    try {
      const link = storage.getLinkById(item.linkId);
      const subfolder = link?.destinationFolder || link?.clientName || null;
      const driveFile = await driveService.uploadToGoogleDrive(
        item.localPath,
        item.fileName,
        item.mimeType,
        subfolder
      );

      // Update upload record in DB
      item.status = 'synced';
      item.driveFileId = driveFile.id;
      item.driveWebViewLink = driveFile.webViewLink;

      // Clean local file
      if (fs.existsSync(item.localPath)) {
        fs.unlinkSync(item.localPath);
      }
      item.localPath = null;
      syncedCount++;
    } catch (err) {
      console.error(`Failed to sync ${item.fileName}:`, err.message);
    }
  }

  const db = storage.loadDB ? storage.loadDB() : null; // save changes
  res.json({ success: true, syncedCount, totalPending: pending.length });
});

// API: Test Google Drive connection
app.get('/api/config/test-drive', async (req, res) => {
  const status = await driveService.testConnection();
  res.json(status);
});

// API: Update settings
app.post('/api/settings', (req, res) => {
  const { googleDriveFolderId } = req.body;
  const updated = storage.updateSettings({
    googleDriveFolderId: googleDriveFolderId ? googleDriveFolderId.trim() : ''
  });
  driveService.reloadClient();
  res.json({ success: true, settings: updated });
});

// API: Save Google Service Account credentials directly from UI
app.post('/api/config/save-credentials', (req, res) => {
  try {
    const { credentialsJson, folderId } = req.body;
    if (!credentialsJson) {
      return res.status(400).json({ error: 'Credentials JSON is required.' });
    }

    // Validate JSON
    const parsed = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
    if (!parsed.client_email || !parsed.private_key) {
      return res.status(400).json({ error: 'Invalid Google Service Account JSON. Missing client_email or private_key.' });
    }

    fs.writeFileSync(config.CREDENTIALS_FILE, JSON.stringify(parsed, null, 2));

    if (folderId) {
      storage.updateSettings({ googleDriveFolderId: folderId.trim() });
    }

    driveService.reloadClient();

    res.json({
      success: true,
      email: parsed.client_email,
      message: 'Google credentials saved successfully! Testing connection...'
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON format: ' + err.message });
  }
});

// OAuth2: Save Client ID & Secret
app.post('/api/config/save-oauth', (req, res) => {
  try {
    const { clientId, clientSecret, oauthJson, folderId } = req.body;
    let configToSave = null;

    if (oauthJson && oauthJson.trim()) {
      configToSave = JSON.parse(oauthJson.trim());
    } else if (clientId && clientSecret) {
      configToSave = {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: `http://localhost:${config.PORT}/oauth2callback`
      };
    } else {
      return res.status(400).json({ error: 'Client ID & Client Secret or OAuth JSON required.' });
    }

    fs.writeFileSync(driveService.OAUTH_CONFIG_PATH, JSON.stringify(configToSave, null, 2));

    if (folderId) {
      storage.updateSettings({ googleDriveFolderId: folderId.trim() });
    }

    const authUrl = driveService.getOAuthAuthUrl();
    res.json({ success: true, authUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// OAuth2: Redirect to Google Login
app.get('/auth/google', (req, res) => {
  const url = driveService.getOAuthAuthUrl();
  if (!url) {
    return res.status(400).send('OAuth is not configured yet. Please configure OAuth Client ID and Secret in settings.');
  }
  res.redirect(url);
});

// OAuth2: Callback URL
app.get('/oauth2callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect('/?oauth_error=' + encodeURIComponent(error));
  }
  if (!code) {
    return res.redirect('/?oauth_error=no_code');
  }

  try {
    const result = await driveService.handleOAuthCallback(code);
    res.redirect('/?oauth_success=1&email=' + encodeURIComponent(result.email || ''));
  } catch (err) {
    res.redirect('/?oauth_error=' + encodeURIComponent(err.message));
  }
});

// OAuth2: Check OAuth status
app.get('/api/config/oauth-status', (req, res) => {
  const isConfigured = fs.existsSync(driveService.OAUTH_CONFIG_PATH);
  const isAuthorized = fs.existsSync(driveService.OAUTH_TOKENS_PATH);
  const authUrl = isConfigured ? driveService.getOAuthAuthUrl() : null;

  res.json({
    isConfigured,
    isAuthorized,
    authUrl
  });
});

// Start Server
const server = app.listen(config.PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Drive Client Drop Portal is running!`);
  console.log(`💻 Admin Dashboard: http://localhost:${config.PORT}`);
  console.log(`📁 Upload destination: ${config.GOOGLE_DRIVE_FOLDER_ID ? 'Google Drive Folder: ' + config.GOOGLE_DRIVE_FOLDER_ID : 'Local fallback + Google Drive'}`);
  console.log(`=================================================`);
});

module.exports = { app, server };
