// Client Upload Page JavaScript

let linkId = '';
let selectedFiles = [];
let linkData = null;

document.addEventListener('DOMContentLoaded', () => {
  // Extract link ID from path /u/:id or /upload/:id
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  linkId = pathParts[pathParts.length - 1];

  if (!linkId) {
    showErrorState('Invalid link address.');
    return;
  }

  fetchLinkDetails();
  setupDragAndDrop();
});

// Fetch link info and validity
async function fetchLinkDetails() {
  try {
    const res = await fetch(`/api/public/link/${linkId}`);
    const data = await res.json();

    document.getElementById('loadingState').style.display = 'none';

    if (!data.valid) {
      showErrorState(data.error || 'Link is invalid or has been deleted.');
      return;
    }

    linkData = data;

    // Check if expired
    if (data.isExpired || data.status === 'expired') {
      document.getElementById('expiredState').style.display = 'block';
      document.getElementById('pageTitle').innerText = data.title || 'Upload Link Expired';
      return;
    }

    // Link is active
    document.getElementById('activeState').style.display = 'block';
    document.getElementById('pageTitle').innerText = data.title || 'Client File Upload';
    
    if (data.clientName) {
      document.getElementById('pageSubtitle').innerText = `Welcome ${data.clientName}! Please upload the requested files below.`;
    }

    if (data.notes) {
      const box = document.getElementById('instructionsBox');
      document.getElementById('instructionsText').innerText = data.notes;
      box.style.display = 'block';
    }

    if (data.maxFileSizeMB) {
      document.getElementById('maxSizeText').innerText = data.maxFileSizeMB;
    }
  } catch (err) {
    document.getElementById('loadingState').style.display = 'none';
    showErrorState('Network error connecting to server. Please refresh.');
  }
}

function showErrorState(msg) {
  const expiredState = document.getElementById('expiredState');
  expiredState.style.display = 'block';
  expiredState.querySelector('h2').innerText = 'Link Not Available';
  expiredState.querySelector('p').innerText = msg;
}

// Drag & drop setup
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFilesSelected(files);
  });
}

function triggerFileInput() {
  document.getElementById('fileInput').click();
}

function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  const maxBytes = (linkData?.maxFileSizeMB || 500) * 1024 * 1024;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > maxBytes) {
      alert(`File "${file.name}" exceeds the allowed size limit of ${linkData.maxFileSizeMB} MB.`);
      continue;
    }

    // Avoid exact duplicate in current selection
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.push(file);
    }
  }

  renderFileList();
}

function renderFileList() {
  const fileListEl = document.getElementById('fileList');
  const uploadBtn = document.getElementById('btnUpload');
  const countBadge = document.getElementById('fileCountBadge');

  if (selectedFiles.length === 0) {
    fileListEl.style.display = 'none';
    uploadBtn.style.display = 'none';
    return;
  }

  fileListEl.style.display = 'flex';
  uploadBtn.style.display = 'flex';
  countBadge.innerText = selectedFiles.length;

  fileListEl.innerHTML = selectedFiles.map((file, idx) => `
    <div class="file-item">
      <div class="file-item-info">
        <i class="fa-regular fa-file" style="color: #818cf8; font-size: 1.25rem;"></i>
        <div>
          <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-item-size">${formatBytes(file.size)}</div>
        </div>
      </div>
      <button class="file-item-remove" onclick="removeFile(${idx})" title="Remove file">&times;</button>
    </div>
  `).join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

// Start uploading files
function startUpload() {
  if (selectedFiles.length === 0) return;

  const uploadBtn = document.getElementById('btnUpload');
  const dropzone = document.getElementById('dropzone');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');

  uploadBtn.disabled = true;
  dropzone.style.pointerEvents = 'none';
  dropzone.style.opacity = '0.5';
  progressContainer.style.display = 'block';

  const formData = new FormData();
  selectedFiles.forEach(file => {
    formData.append('files', file);
  });

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/api/upload/${linkId}`, true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentComplete = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percentComplete + '%';
      progressPercent.innerText = percentComplete + '%';
      progressText.innerText = percentComplete === 100 
        ? 'Processing & Syncing to Cloud Storage...' 
        : `Uploading ${selectedFiles.length} file(s)...`;
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        showUploadSuccess(response.files || []);
      } catch (e) {
        showUploadSuccess(selectedFiles);
      }
    } else if (xhr.status === 403) {
      // Link expired during upload
      alert('This link has expired or has been closed by the owner.');
      window.location.reload();
    } else {
      let err = 'Upload failed. Please try again.';
      try {
        const errObj = JSON.parse(xhr.responseText);
        if (errObj.error) err = errObj.error;
      } catch (e) {}
      alert(err);
      resetUploaderState();
    }
  };

  xhr.onerror = () => {
    alert('Network error while uploading. Please check your connection.');
    resetUploaderState();
  };

  xhr.send(formData);
}

function resetUploaderState() {
  const uploadBtn = document.getElementById('btnUpload');
  const dropzone = document.getElementById('dropzone');
  const progressContainer = document.getElementById('progressContainer');

  uploadBtn.disabled = false;
  dropzone.style.pointerEvents = 'auto';
  dropzone.style.opacity = '1';
  progressContainer.style.display = 'none';
}

function showUploadSuccess(uploadedFiles) {
  document.getElementById('activeState').style.display = 'none';
  const successState = document.getElementById('successState');
  successState.style.display = 'block';

  const summary = document.getElementById('uploadedFilesSummary');
  summary.innerHTML = uploadedFiles.map(f => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <span><i class="fa-solid fa-file-circle-check" style="color: #34d399; margin-right: 6px;"></i> ${escapeHtml(f.fileName || f.name)}</span>
      <span style="color: var(--text-muted); font-size: 0.75rem;">${formatBytes(f.size || f.fileSize || 0)}</span>
    </div>
  `).join('');
}

function resetUploader() {
  selectedFiles = [];
  document.getElementById('fileInput').value = '';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('activeState').style.display = 'block';
  resetUploaderState();
  renderFileList();
}

function formatBytes(bytes, decimals = 1) {
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
