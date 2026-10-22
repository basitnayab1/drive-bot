// Client Upload Page JavaScript

let linkId = '';
let selectedFiles = [];
let linkData = null;
let activePreviewIndex = -1;

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
  let firstNewIdx = -1;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > maxBytes) {
      alert(`File "${file.name}" exceeds the allowed size limit of ${linkData?.maxFileSizeMB || 500} MB.`);
      continue;
    }

    // Avoid exact duplicate in current selection
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      const type = (file.type || '').toLowerCase();
      const ext = (file.name.split('.').pop() || '').toLowerCase();

      // Generate local object URL for previewing image, video, or audio
      if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/') || 
          ['jpg','jpeg','png','gif','webp','svg','mp4','mov','webm','avi','mkv','mp3','wav'].includes(ext)) {
        try {
          file._previewUrl = URL.createObjectURL(file);
        } catch (e) {}
      }

      selectedFiles.push(file);
      if (firstNewIdx === -1) {
        firstNewIdx = selectedFiles.length - 1;
      }
    }
  }

  // Clear input so selecting the same file again triggers change
  document.getElementById('fileInput').value = '';

  renderFileList();

  // If no preview is currently open and we just added media, open preview on the first newly added item
  if (activePreviewIndex === -1 && firstNewIdx !== -1 && window.innerWidth > 900) {
    const firstAdded = selectedFiles[firstNewIdx];
    const info = getFileTypeInfo(firstAdded);
    if (info.type === 'image' || info.type === 'video') {
      openSidePreview(firstNewIdx);
    }
  }
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
    
    // Close preview directly without invoking renderFileList recursively
    activePreviewIndex = -1;
    const panel = document.getElementById('sidePreviewPanel');
    const container = document.getElementById('portalContainer');
    const body = document.getElementById('sidePreviewBody');
    if (body) body.innerHTML = '';
    if (panel) panel.style.display = 'none';
    if (container) container.classList.remove('has-preview');
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

    const isActive = activePreviewIndex === idx;

    return `
      <div class="file-item-card ${isActive ? 'is-active-preview' : ''}" id="fileItem_${idx}" onclick="toggleSidePreview(${idx})" title="Click to view ${info.type === 'video' ? 'video' : info.type === 'image' ? 'photo' : 'file'} on side">
        <div class="file-item-left">
          ${previewHtml}
          <div class="file-details">
            <div class="file-name-text" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="file-meta-row">
              <span class="badge-ext">${escapeHtml(info.ext)}</span>
              <span>${formatBytes(file.size)}</span>
              ${isActive ? '<span class="badge-ext" style="background: rgba(99, 102, 241, 0.25); color: #c7d2fe;"><i class="fa-solid fa-eye"></i> Viewing</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="btn-card-preview" title="View file on side">
            <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isActive ? 'Close' : 'View'}
          </span>
          <button type="button" class="btn-remove-item" onclick="event.stopPropagation(); removeFile(${idx})" title="Remove this file">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Side preview controls
function openSidePreview(index) {
  if (index < 0 || index >= selectedFiles.length) return;

  activePreviewIndex = index;
  const file = selectedFiles[index];
  const info = getFileTypeInfo(file);

  const panel = document.getElementById('sidePreviewPanel');
  const container = document.getElementById('portalContainer');
  const body = document.getElementById('sidePreviewBody');
  const nameEl = document.getElementById('sidePreviewFileName');
  const metaEl = document.getElementById('sidePreviewMeta');
  const navIndexEl = document.getElementById('previewNavIndex');

  if (!panel || !body) return;

  panel.style.display = 'block';
  if (container) container.classList.add('has-preview');

  if (nameEl) {
    nameEl.innerText = file.name || 'File Preview';
    nameEl.title = file.name || '';
  }
  if (metaEl) {
    metaEl.innerText = `${info.ext} • ${formatBytes(file.size)}`;
  }
  if (navIndexEl) {
    navIndexEl.innerText = `File ${index + 1} of ${selectedFiles.length}`;
  }

  // Render media content
  if (info.type === 'image' && file._previewUrl) {
    body.innerHTML = `<img src="${file._previewUrl}" alt="${escapeHtml(file.name)}" class="side-media-img">`;
  } else if (info.type === 'video' && file._previewUrl) {
    body.innerHTML = `
      <video class="side-media-video" controls autoplay playsinline>
        <source src="${file._previewUrl}" type="${file.type || 'video/mp4'}">
        Your browser does not support the video tag.
      </video>
    `;
  } else if (info.type === 'audio' && file._previewUrl) {
    body.innerHTML = `
      <div style="text-align: center; width: 100%; padding: 2rem 1rem;">
        <div class="side-doc-icon ${info.className}" style="font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-music"></i></div>
        <audio class="side-media-audio" controls autoplay style="width: 100%;">
          <source src="${file._previewUrl}" type="${file.type || 'audio/mpeg'}">
        </audio>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div class="side-doc-card">
        <div class="side-doc-icon ${info.className}"><i class="fa-solid ${info.icon}"></i></div>
        <h4 style="color: #f1f5f9; margin-bottom: 0.5rem; word-break: break-all; font-size: 1rem;">${escapeHtml(file.name)}</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem;">${info.ext} Document • ${formatBytes(file.size)}</p>
        <div style="margin-top: 1.25rem; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(16, 185, 129, 0.12); color: #34d399; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
          <i class="fa-solid fa-circle-check"></i> Ready for upload
        </div>
      </div>
    `;
  }

  renderFileList();
}

function closeSidePreview() {
  activePreviewIndex = -1;
  const panel = document.getElementById('sidePreviewPanel');
  const container = document.getElementById('portalContainer');
  const body = document.getElementById('sidePreviewBody');

  if (body) body.innerHTML = '';
  if (panel) panel.style.display = 'none';
  if (container) container.classList.remove('has-preview');

  if (selectedFiles.length > 0) {
    renderFileList();
  }
}

function toggleSidePreview(index) {
  if (activePreviewIndex === index) {
    closeSidePreview();
  } else {
    openSidePreview(index);
  }
}

function prevPreview() {
  if (activePreviewIndex > 0) {
    openSidePreview(activePreviewIndex - 1);
  } else if (selectedFiles.length > 0) {
    openSidePreview(selectedFiles.length - 1);
  }
}

function nextPreview() {
  if (activePreviewIndex < selectedFiles.length - 1) {
    openSidePreview(activePreviewIndex + 1);
  } else if (selectedFiles.length > 0) {
    openSidePreview(0);
  }
}

function removeFile(index) {
  if (selectedFiles[index] && selectedFiles[index]._previewUrl) {
    try {
      URL.revokeObjectURL(selectedFiles[index]._previewUrl);
    } catch (e) {}
  }

  const wasActive = activePreviewIndex === index;

  selectedFiles.splice(index, 1);

  if (selectedFiles.length === 0) {
    renderFileList();
  } else if (wasActive) {
    // If the active one was deleted, switch to the next valid or close
    const newIdx = Math.min(index, selectedFiles.length - 1);
    openSidePreview(newIdx);
  } else if (activePreviewIndex > index) {
    activePreviewIndex--;
    renderFileList();
  } else {
    renderFileList();
  }
}

function clearAllFiles() {
  selectedFiles.forEach(f => {
    if (f._previewUrl) {
      try { URL.revokeObjectURL(f._previewUrl); } catch (e) {}
    }
  });
  selectedFiles = [];
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
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
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');

  if (uploadBtn) {
    uploadBtn.disabled = false;
    uploadBtn.style.display = 'none';
  }
  if (dropzone) {
    dropzone.style.pointerEvents = 'auto';
    dropzone.style.opacity = '1';
    dropzone.classList.remove('dragover');
  }
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';
  if (progressPercent) progressPercent.innerText = '0%';
  if (progressText) progressText.innerText = 'Uploading...';
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
  const successState = document.getElementById('successState');
  const activeState = document.getElementById('activeState');
  if (successState) successState.style.display = 'none';
  if (activeState) activeState.style.display = 'block';
  resetUploaderState();
  triggerFileInput();
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
