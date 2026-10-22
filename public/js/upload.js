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

// Get file type metadata, icon and extension info
function getFileTypeInfo(file) {
  const name = file.name || file.fileName || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (file.type || file.mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return {
      type: 'image',
      icon: 'fa-file-image',
      className: 'icon-image',
      ext: ext || 'IMG'
    };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      type: 'pdf',
      icon: 'fa-file-pdf',
      className: 'icon-pdf',
      ext: 'PDF'
    };
  }
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) {
    return {
      type: 'doc',
      icon: 'fa-file-word',
      className: 'icon-word',
      ext: ext.toUpperCase()
    };
  }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return {
      type: 'sheet',
      icon: 'fa-file-excel',
      className: 'icon-excel',
      ext: ext.toUpperCase()
    };
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'].includes(ext) || mime.startsWith('video/')) {
    return {
      type: 'video',
      icon: 'fa-file-video',
      className: 'icon-video',
      ext: ext.toUpperCase()
    };
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext) || mime.startsWith('audio/')) {
    return {
      type: 'audio',
      icon: 'fa-file-audio',
      className: 'icon-audio',
      ext: ext.toUpperCase()
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      type: 'archive',
      icon: 'fa-file-zipper',
      className: 'icon-archive',
      ext: ext.toUpperCase()
    };
  }
  if (['js', 'ts', 'html', 'css', 'json', 'py', 'java', 'cpp', 'c', 'php', 'sql'].includes(ext)) {
    return {
      type: 'code',
      icon: 'fa-file-code',
      className: 'icon-code',
      ext: ext.toUpperCase()
    };
  }
  return {
    type: 'default',
    icon: 'fa-file-lines',
    className: 'icon-default',
    ext: ext ? ext.toUpperCase() : 'FILE'
  };
}

function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  const maxBytes = (linkData?.maxFileSizeMB || 500) * 1024 * 1024;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > maxBytes) {
      alert(`File "${file.name}" exceeds the allowed size limit of ${linkData?.maxFileSizeMB || 500} MB.`);
      continue;
    }

    // Avoid exact duplicate in current selection
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      if (file.type && file.type.startsWith('image/')) {
        try {
          file._previewUrl = URL.createObjectURL(file);
        } catch (e) {}
      }
      selectedFiles.push(file);
    }
  }

  // Clear input so selecting the same file again triggers change
  document.getElementById('fileInput').value = '';

  renderFileList();
}

function renderFileList() {
  const section = document.getElementById('selectedFilesSection');
  const fileListEl = document.getElementById('fileList');
  const uploadBtn = document.getElementById('btnUpload');
  const countBadge = document.getElementById('fileCountBadge');
  const btnCountBadge = document.getElementById('fileCountBtnBadge');
  const totalSizeBadge = document.getElementById('totalSizeBadge');

  if (selectedFiles.length === 0) {
    if (section) section.style.display = 'none';
    if (fileListEl) fileListEl.innerHTML = '';
    if (uploadBtn) uploadBtn.style.display = 'none';
    return;
  }

  if (section) section.style.display = 'block';
  if (uploadBtn) uploadBtn.style.display = 'flex';

  const totalBytes = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  if (countBadge) countBadge.innerText = selectedFiles.length;
  if (btnCountBadge) btnCountBadge.innerText = selectedFiles.length;
  if (totalSizeBadge) totalSizeBadge.innerText = formatBytes(totalBytes);

  fileListEl.innerHTML = selectedFiles.map((file, idx) => {
    const info = getFileTypeInfo(file);
    let previewHtml = '';

    if (info.type === 'image' && file._previewUrl) {
      previewHtml = `<img src="${file._previewUrl}" alt="Preview" class="file-thumb-preview" onerror="this.onerror=null; this.src=''; this.className='file-icon-badge icon-image';">`;
    } else {
      previewHtml = `<div class="file-icon-badge ${info.className}"><i class="fa-solid ${info.icon}"></i></div>`;
    }

    return `
      <div class="file-item-card" id="fileItem_${idx}">
        <div class="file-item-left">
          ${previewHtml}
          <div class="file-details">
            <div class="file-name-text" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="file-meta-row">
              <span class="badge-ext">${escapeHtml(info.ext)}</span>
              <span>${formatBytes(file.size)}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="removeFile(${idx})" title="Remove this file">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
  }).join('');
}

function removeFile(index) {
  if (selectedFiles[index] && selectedFiles[index]._previewUrl) {
    try {
      URL.revokeObjectURL(selectedFiles[index]._previewUrl);
    } catch (e) {}
  }
  selectedFiles.splice(index, 1);
  renderFileList();
}

function clearAllFiles() {
  selectedFiles.forEach(f => {
    if (f._previewUrl) {
      try { URL.revokeObjectURL(f._previewUrl); } catch (e) {}
    }
  });
  selectedFiles = [];
  document.getElementById('fileInput').value = '';
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

  const filesArray = uploadedFiles && uploadedFiles.length > 0 ? uploadedFiles : selectedFiles;
  const count = filesArray.length;
  const totalBytes = filesArray.reduce((acc, f) => acc + (f.size || f.fileSize || 0), 0);

  const countEl = document.getElementById('successFileCount');
  const sizeEl = document.getElementById('successTotalSize');
  if (countEl) countEl.innerText = count;
  if (sizeEl) sizeEl.innerText = formatBytes(totalBytes);

  const summary = document.getElementById('uploadedFilesSummary');
  summary.innerHTML = filesArray.map(f => {
    const info = getFileTypeInfo(f);
    const fileName = f.fileName || f.name || 'File';
    const fileSize = f.size || f.fileSize || 0;

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.65rem; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 0.95rem; flex-shrink: 0;"></i>
          <span style="font-size: 0.84rem; font-weight: 500; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(fileName)}">
            ${escapeHtml(fileName)}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
          <span class="badge-ext">${escapeHtml(info.ext)}</span>
          <span style="color: var(--text-muted); font-size: 0.74rem;">${formatBytes(fileSize)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function resetUploader() {
  clearAllFiles();
  document.getElementById('successState').style.display = 'none';
  document.getElementById('activeState').style.display = 'block';
  resetUploaderState();
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
