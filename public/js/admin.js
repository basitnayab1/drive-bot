// Admin Dashboard JS

let allLinks = [];
let allUploads = [];

document.addEventListener('DOMContentLoaded', () => {
  // Check for OAuth callback redirects
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('oauth_success')) {
    const email = urlParams.get('email');
    showToast(`Google Drive connected successfully as ${email || 'your account'}! (15GB Personal Storage)`, 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('oauth_error')) {
    showToast(`OAuth Error: ${urlParams.get('oauth_error')}`, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  loadDashboard();
  // Poll periodically every 15 seconds for updates
  setInterval(loadDashboard, 15000);
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div style="flex: 1;">${message}</div>
    <button style="background: none; border: none; color: #94a3b8; cursor: pointer;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch dashboard overview
async function loadDashboard() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    // Update stats
    document.getElementById('statTotalLinks').innerText = data.totalLinks || 0;
    document.getElementById('statActiveLinks').innerText = data.activeLinksCount || 0;
    document.getElementById('statExpiredLinks').innerText = data.expiredLinksCount || 0;
    document.getElementById('statFilesUploaded').innerText = data.totalUploadsCount || 0;

    // Update Drive Status Pill
    updateDrivePill(data.googleDrive);

    // Load Links
    await fetchLinks();

    // Load Uploads
    await fetchUploads();
  } catch (err) {
    console.error('Error fetching dashboard status:', err);
  }
}

// Update the Google Drive status indicator in the top navbar
function updateDrivePill(drive) {
  const pill = document.getElementById('driveStatusPill');
  const dot = document.getElementById('driveDot');
  const text = document.getElementById('driveStatusText');

  if (drive && drive.connected) {
    if (drive.folderValid) {
      dot.className = 'status-dot online';
      text.innerText = `Google Drive Connected (${drive.folderName || 'Ready'})`;
      pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else {
      dot.className = 'status-dot warning';
      text.innerText = `Drive Connected (Folder Setup Needed)`;
      pill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    }
  } else {
    dot.className = 'status-dot offline';
    text.innerText = 'Google Drive Not Connected (Click to Setup)';
    pill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  }
}

// Fetch all links
async function fetchLinks() {
  try {
    const res = await fetch('/api/links');
    const data = await res.json();
    allLinks = data.links || [];
    renderLinks(allLinks);
  } catch (err) {
    console.error('Error fetching links:', err);
  }
}

// Render links in grid
function renderLinks(links) {
  const container = document.getElementById('linksContainer');

  if (!links || links.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-link-slash"></i></div>
        <h3>No upload links created yet</h3>
        <p>Click "Create Upload Link" above to generate your first link for a client.</p>
      </div>
    `;
    return;
  }

  const currentDomain = window.location.origin;

  container.innerHTML = links.map(link => {
    const isExpired = link.status === 'expired' || (link.expiresAt && new Date(link.expiresAt) <= new Date());
    const publicUrl = `${currentDomain}/u/${link.id}`;

    // Format expiry text
    let expiryDisplay = 'No auto-expiration';
    if (link.expiresAt) {
      const expDate = new Date(link.expiresAt);
      if (isExpired) {
        expiryDisplay = `<span style="color: #f87171;">Expired on ${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
      } else {
        expiryDisplay = `<span>Expires ${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
      }
    }

    return `
      <div class="link-item ${isExpired ? 'expired' : ''}">
        <div class="link-details">
          <div class="link-meta-top">
            <span class="link-title">${escapeHtml(link.title)}</span>
            ${link.clientName ? `<span class="client-tag"><i class="fa-solid fa-user"></i> ${escapeHtml(link.clientName)}</span>` : ''}
            <span class="badge ${isExpired ? 'badge-expired' : 'badge-active'}">
              <i class="fa-solid ${isExpired ? 'fa-ban' : 'fa-circle-check'}"></i> ${isExpired ? 'Expired' : 'Active'}
            </span>
          </div>

          <div class="link-url-box">
            <input type="text" class="link-url-input" value="${publicUrl}" readonly onclick="this.select()">
            <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${publicUrl}')" title="Copy Client Link">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
            <a href="${publicUrl}" target="_blank" class="btn btn-secondary btn-sm" title="Preview Upload Page">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>

          <div class="link-stats-row">
            <span><i class="fa-solid fa-clock"></i> ${expiryDisplay}</span>
            <span><i class="fa-solid fa-file-arrow-up"></i> ${link.uploadCount || 0} file(s) uploaded</span>
            <span><i class="fa-solid fa-hard-drive"></i> Max ${link.maxFileSizeMB || 500} MB</span>
            ${link.destinationFolder ? `<span><i class="fa-brands fa-google-drive"></i> Subfolder: <em>${escapeHtml(link.destinationFolder)}</em></span>` : ''}
          </div>
        </div>

        <div class="link-actions">
          ${isExpired ? `
            <button class="btn btn-success btn-sm" onclick="toggleLinkStatus('${link.id}')" title="Reactivate this upload link so client can upload again">
              <i class="fa-solid fa-play"></i> Reactivate Link
            </button>
          ` : `
            <button class="btn btn-danger btn-sm" onclick="toggleLinkStatus('${link.id}')" title="Expire this link immediately. Client won't be able to upload.">
              <i class="fa-solid fa-ban"></i> Expire Link Now
            </button>
          `}
          
          <button class="btn btn-secondary btn-sm btn-icon" onclick="deleteLink('${link.id}')" title="Delete link permanently">
            <i class="fa-solid fa-trash-can" style="color: #f87171;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Fetch all uploaded files history
async function fetchUploads() {
  try {
    const res = await fetch('/api/uploads');
    const data = await res.json();
    allUploads = data.uploads || [];
    renderUploads(allUploads);
  } catch (err) {
    console.error('Error fetching uploads:', err);
  }
}

// Render uploads in table
function renderUploads(uploads) {
  const tbody = document.getElementById('uploadsTableBody');
  const syncBtn = document.getElementById('syncPendingBtnWrapper');

  const hasPending = uploads.some(u => u.status === 'saved_locally');
  if (syncBtn) {
    syncBtn.style.display = hasPending ? 'block' : 'none';
  }

  if (!uploads || uploads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No files uploaded yet. Once a client uploads a file through any active link, it will appear here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = uploads.map(item => {
    const formattedSize = formatBytes(item.fileSize);
    const timeFormatted = new Date(item.uploadedAt).toLocaleString();

    let statusHtml = '';
    if (item.status === 'synced') {
      statusHtml = `
        <span class="badge badge-active">
          <i class="fa-brands fa-google-drive"></i> Synced to Drive
        </span>
      `;
    } else {
      statusHtml = `
        <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">
          <i class="fa-solid fa-floppy-disk"></i> Saved Locally
        </span>
      `;
    }

    let actionBtn = '-';
    if (item.driveWebViewLink) {
      actionBtn = `
        <a href="${item.driveWebViewLink}" target="_blank" class="btn btn-secondary btn-sm" title="Open file directly in Google Drive">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in Drive
        </a>
      `;
    }

    return `
      <tr>
        <td>
          <div class="file-name-cell">
            <div class="file-icon-badge">
              <i class="fa-regular fa-file"></i>
            </div>
            <div>
              <div>${escapeHtml(item.fileName)}</div>
              <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">${item.mimeType || 'file'}</div>
            </div>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(item.linkTitle || 'Upload')}</strong>
          ${item.clientName ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.clientName)}</div>` : ''}
        </td>
        <td>${formattedSize}</td>
        <td>${timeFormatted}</td>
        <td>${statusHtml}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

// Copy link to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copied to clipboard! Share it with your client.', 'success');
  }).catch(() => {
    showToast('Could not copy link automatically.', 'error');
  });
}

// Toggle link status (Active <-> Expire)
async function toggleLinkStatus(linkId) {
  try {
    const res = await fetch(`/api/links/${linkId}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const isExpired = data.link.status === 'expired';
      showToast(
        isExpired 
          ? 'Link expired successfully! Client can no longer upload.' 
          : 'Link reactivated successfully!', 
        'success'
      );
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to update link status', 'error');
    }
  } catch (err) {
    showToast('Network error while updating link status', 'error');
  }
}

// Delete link
async function deleteLink(linkId) {
  if (!confirm('Are you sure you want to delete this link? The client link will no longer work.')) {
    return;
  }

  try {
    const res = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Link deleted successfully', 'info');
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to delete link', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting link', 'error');
  }
}

// Modal controls: Create Link
function openCreateModal() {
  document.getElementById('createLinkModal').classList.add('active');
  document.getElementById('linkTitle').focus();
}

function closeCreateModal() {
  document.getElementById('createLinkModal').classList.remove('active');
}

function toggleCustomExpiry(val) {
  const customGroup = document.getElementById('customExpiryGroup');
  customGroup.style.display = val === 'custom' ? 'block' : 'none';
}

// Handle link creation
async function handleCreateLink(e) {
  e.preventDefault();

  const title = document.getElementById('linkTitle').value;
  const clientName = document.getElementById('clientName').value;
  const destinationFolder = document.getElementById('destinationFolder').value;
  const expiryOption = document.getElementById('expiryOption').value;
  const maxFileSizeMB = document.getElementById('maxFileSize').value;
  const notes = document.getElementById('linkNotes').value;

  let expiresAt = null;
  const now = new Date();

  if (expiryOption === '1h') {
    expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (expiryOption === '24h') {
    expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  } else if (expiryOption === '7d') {
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (expiryOption === '30d') {
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (expiryOption === 'custom') {
    const customDateVal = document.getElementById('customExpiryDate').value;
    if (customDateVal) {
      expiresAt = new Date(customDateVal).toISOString();
    }
  }

  const payload = {
    title,
    clientName,
    destinationFolder,
    expiresAt,
    maxFileSizeMB,
    notes
  };

  try {
    const btn = document.getElementById('btnSubmitLink');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Generate Link';

    if (data.success) {
      showToast('Upload link generated successfully! You can copy and share it now.', 'success');
      closeCreateModal();
      document.getElementById('createLinkForm').reset();
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to create link', 'error');
    }
  } catch (err) {
    showToast('Failed to create link due to network error.', 'error');
  }
}

// Modal controls: Google Drive Settings
function openDriveModal() {
  document.getElementById('driveSettingsModal').classList.add('active');
  checkDriveConnection();
}

function closeDriveModal() {
  document.getElementById('driveSettingsModal').classList.remove('active');
}

// Switch between OAuth tab and Service Account tab
function switchDriveTab(tab) {
  const oauthBtn = document.getElementById('tabOAuthBtn');
  const serviceBtn = document.getElementById('tabServiceBtn');
  const oauthSec = document.getElementById('oauthSection');
  const serviceSec = document.getElementById('serviceAccountSection');

  if (tab === 'oauth') {
    oauthBtn.className = 'btn btn-sm btn-primary';
    serviceBtn.className = 'btn btn-sm btn-secondary';
    oauthSec.style.display = 'block';
    serviceSec.style.display = 'none';
  } else {
    oauthBtn.className = 'btn btn-sm btn-secondary';
    serviceBtn.className = 'btn btn-sm btn-primary';
    oauthSec.style.display = 'none';
    serviceSec.style.display = 'block';
  }
}

// Save OAuth Client ID & Secret and redirect to Google Login
async function saveOAuthAndLogin() {
  const clientId = document.getElementById('oauthClientId').value;
  const clientSecret = document.getElementById('oauthClientSecret').value;
  const folderId = document.getElementById('driveFolderIdInput').value;

  if (!clientId || !clientSecret) {
    showToast('Please enter both OAuth Client ID and Client Secret.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/config/save-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, folderId })
    });

    const data = await res.json();
    if (data.success && data.authUrl) {
      showToast('Redirecting to Google to authorize your 15GB drive...', 'info');
      setTimeout(() => {
        window.location.href = data.authUrl;
      }, 800);
    } else {
      showToast(data.error || 'Failed to save OAuth settings', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

// Test Drive Connection
async function checkDriveConnection() {
  const diagBox = document.getElementById('driveDiagnosticBox');
  const title = document.getElementById('diagnosticTitle');
  const msg = document.getElementById('diagnosticMsg');

  title.innerText = 'Testing connection to Google Drive...';
  msg.innerText = 'Verifying credentials and target folder accessibility...';

  try {
    const res = await fetch('/api/config/test-drive');
    const data = await res.json();

    if (data.connected && data.folderValid) {
      diagBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      diagBox.style.background = 'rgba(16, 185, 129, 0.08)';
      title.innerHTML = '<span style="color: #34d399;"><i class="fa-solid fa-circle-check"></i> Connected & Ready</span>';
      msg.innerHTML = `Connected as <code>${data.email}</code>. Destination folder: <strong>${data.folderName}</strong>.`;
    } else if (data.connected && !data.folderValid) {
      diagBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      diagBox.style.background = 'rgba(245, 158, 11, 0.08)';
      title.innerHTML = '<span style="color: #fbbf24;"><i class="fa-solid fa-triangle-exclamation"></i> Connected, but Target Folder Needed</span>';
      msg.innerHTML = data.message;
    } else {
      diagBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      diagBox.style.background = 'rgba(239, 68, 68, 0.08)';
      title.innerHTML = '<span style="color: #f87171;"><i class="fa-solid fa-circle-xmark"></i> Not Connected</span>';
      msg.innerHTML = data.message || 'Credentials not configured yet. Follow the steps below.';
    }
  } catch (err) {
    title.innerText = 'Connection check failed';
    msg.innerText = err.message;
  }
}

// Save Drive Credentials / Folder ID
async function saveDriveSettings() {
  const folderId = document.getElementById('driveFolderIdInput').value;
  const jsonContent = document.getElementById('serviceAccountJsonInput').value;

  try {
    if (jsonContent && jsonContent.trim()) {
      const res = await fetch('/api/config/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialsJson: jsonContent.trim(), folderId })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to save credentials', 'error');
        return;
      }
      showToast('Google credentials saved successfully!', 'success');
    } else if (folderId && folderId.trim()) {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDriveFolderId: folderId.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Google Drive folder ID updated!', 'success');
      }
    }

    checkDriveConnection();
    loadDashboard();
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'error');
  }
}

// Sync pending files to Drive
async function syncPendingFiles() {
  try {
    showToast('Syncing pending local files to Google Drive...', 'info');
    const res = await fetch('/api/sync-pending', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Synced ${data.syncedCount} file(s) to Google Drive!`, 'success');
      loadDashboard();
    } else {
      showToast('Failed to sync files: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Sync request failed: ' + err.message, 'error');
  }
}

// Helpers
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
