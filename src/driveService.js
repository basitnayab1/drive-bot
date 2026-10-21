const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('./config');
const storage = require('./storage');

const OAUTH_TOKENS_PATH = path.join(config.DATA_DIR, 'oauth_tokens.json');
const OAUTH_CONFIG_PATH = path.join(config.DATA_DIR, 'oauth_client.json');

let driveClient = null;
let currentAuthMode = null; // 'oauth2' or 'service_account'

function getOAuthClient() {
  let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  let redirectUri = `http://localhost:${config.PORT}/oauth2callback`;

  if (fs.existsSync(OAUTH_CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(OAUTH_CONFIG_PATH, 'utf-8'));
      if (cfg.web || cfg.installed) {
        const c = cfg.web || cfg.installed;
        clientId = c.client_id;
        clientSecret = c.client_secret;
        redirectUri = (c.redirect_uris && c.redirect_uris[0]) || redirectUri;
      } else if (cfg.client_id) {
        clientId = cfg.client_id;
        clientSecret = cfg.client_secret;
        redirectUri = cfg.redirect_uri || redirectUri;
      }
    } catch (e) {}
  }

  if (!clientId || !clientSecret) return null;

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // If we already have saved tokens, set them
  if (fs.existsSync(OAUTH_TOKENS_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(OAUTH_TOKENS_PATH, 'utf-8'));
      oAuth2Client.setCredentials(tokens);

      // Listen for token updates (refresh)
      oAuth2Client.on('tokens', (newTokens) => {
        const merged = { ...tokens, ...newTokens };
        fs.writeFileSync(OAUTH_TOKENS_PATH, JSON.stringify(merged, null, 2));
      });
    } catch (e) {
      console.error('Error reading oauth_tokens.json:', e);
    }
  }

  return oAuth2Client;
}

function getDriveClient() {
  if (driveClient) return driveClient;

  // 1. Try OAuth2 first (Preferred for personal 15GB Google Drive accounts)
  const oauthClient = getOAuthClient();
  if (oauthClient && fs.existsSync(OAUTH_TOKENS_PATH)) {
    try {
      driveClient = google.drive({ version: 'v3', auth: oauthClient });
      currentAuthMode = 'oauth2';
      return driveClient;
    } catch (err) {
      console.error('OAuth Drive initialization failed:', err.message);
    }
  }

  // 2. Try Service Account (Workspace / Shared Drives)
  if (fs.existsSync(config.CREDENTIALS_FILE)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(config.CREDENTIALS_FILE, 'utf-8'));
      if (credentials.type === 'service_account') {
        const auth = new google.auth.GoogleAuth({
          keyFile: config.CREDENTIALS_FILE,
          scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
        });
        driveClient = google.drive({ version: 'v3', auth });
        currentAuthMode = 'service_account';
        return driveClient;
      }
    } catch (err) {
      console.error('Service Account initialization failed:', err.message);
    }
  }

  return null;
}

function reloadClient() {
  driveClient = null;
  currentAuthMode = null;
  return getDriveClient();
}

/**
 * Generate Google OAuth Login URL
 */
function getOAuthAuthUrl() {
  const oauthClient = getOAuthClient();
  if (!oauthClient) return null;

  return oauthClient.generateAuthUrl({
    access_type: 'offline', // Get refresh_token for permanent access
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
}

/**
 * Handle OAuth Callback code and exchange for tokens
 */
async function handleOAuthCallback(code) {
  const oauthClient = getOAuthClient();
  if (!oauthClient) throw new Error('OAuth Client not configured.');

  const { tokens } = await oauthClient.getToken(code);
  oauthClient.setCredentials(tokens);
  fs.writeFileSync(OAUTH_TOKENS_PATH, JSON.stringify(tokens, null, 2));

  reloadClient();

  // Fetch user email to display in dashboard
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
    const userinfo = await oauth2.userinfo.get();
    return { success: true, email: userinfo.data.email };
  } catch (e) {
    return { success: true };
  }
}

/**
 * Test Google Drive connection
 */
async function testConnection() {
  const drive = getDriveClient();
  if (!drive) {
    const hasOAuthCfg = !!getOAuthClient();
    return {
      connected: false,
      authMode: null,
      message: hasOAuthCfg 
        ? 'OAuth configured. Please click "Sign in with Google" to authorize access.'
        : 'Google Drive not connected. Please set up OAuth (Personal Drive) or Service Account.'
    };
  }

  try {
    const settings = storage.getSettings();
    const folderId = settings.googleDriveFolderId || config.GOOGLE_DRIVE_FOLDER_ID;

    // Check account info
    let accountEmail = 'Google Account';
    if (currentAuthMode === 'oauth2') {
      try {
        const oauthClient = getOAuthClient();
        const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
        const userinfo = await oauth2.userinfo.get();
        accountEmail = userinfo.data.email;
      } catch (e) {}
    } else {
      try {
        const creds = JSON.parse(fs.readFileSync(config.CREDENTIALS_FILE, 'utf-8'));
        accountEmail = creds.client_email;
      } catch (e) {}
    }

    let folderInfo = null;
    if (folderId) {
      try {
        const res = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType, capabilities',
          supportsAllDrives: true
        });
        folderInfo = {
          name: res.data.name,
          canAddChildren: res.data.capabilities?.canAddChildren
        };
      } catch (folderErr) {
        return {
          connected: true,
          authMode: currentAuthMode,
          email: accountEmail,
          folderValid: false,
          message: `Connected as ${accountEmail}, but cannot access folder "${folderId}". Make sure the folder exists and is accessible.`
        };
      }
    }

    return {
      connected: true,
      authMode: currentAuthMode,
      email: accountEmail,
      folderValid: !!folderInfo,
      folderName: folderInfo?.name,
      message: folderInfo
        ? `Connected to Google Drive (${currentAuthMode === 'oauth2' ? 'Personal Account' : 'Service Account'}) as ${accountEmail}! Uploading to folder: "${folderInfo.name}"`
        : `Connected to Google Drive as ${accountEmail}. Please specify a Target Folder ID in settings.`
    };
  } catch (err) {
    return {
      connected: false,
      authMode: currentAuthMode,
      message: `Google Drive connection error: ${err.message}`
    };
  }
}

/**
 * Upload a local file to Google Drive
 */
async function uploadToGoogleDrive(filePath, originalFilename, mimeType, subfolderName = null) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive client is not configured.');
  }

  const settings = storage.getSettings();
  const baseFolderId = settings.googleDriveFolderId || config.GOOGLE_DRIVE_FOLDER_ID;

  let targetFolderId = baseFolderId;

  const fileMetadata = {
    name: originalFilename
  };

  if (targetFolderId) {
    fileMetadata.parents = [targetFolderId];
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink, size',
    supportsAllDrives: true
  });

  return response.data;
}

module.exports = {
  getDriveClient,
  reloadClient,
  testConnection,
  uploadToGoogleDrive,
  getOAuthAuthUrl,
  handleOAuthCallback,
  OAUTH_CONFIG_PATH,
  OAUTH_TOKENS_PATH
};
