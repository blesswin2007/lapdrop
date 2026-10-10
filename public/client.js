// Initialize Socket.io client
const socket = io();

// DOM elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status');
const downloadLink = document.getElementById('download-link');
const fileList = document.getElementById('file-list');
const emptyState = document.getElementById('empty-state');
const itemCount = document.getElementById('item-count');

// Lightbox elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementsByClassName('lightbox-close')[0];

let totalTransfers = 0;

// Click on drop zone opens file selector
dropZone.addEventListener('click', () => {
    fileInput.click();
});

// File input selection event
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        sendFile(file);
    }
});

// Drag and drop event listeners
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        sendFile(files[0]);
    }
});

// Helper to format file sizes dynamically (Bytes, KB, MB, GB, TB)
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk
const TARGET_SPEED_MBPS = 10.5; // Target 10.5 MB/s steady Wi-Fi rate
const TARGET_MS_PER_CHUNK = (CHUNK_SIZE / (TARGET_SPEED_MBPS * 1024 * 1024)) * 1000; // ~190ms per 2MB chunk
const activeDownloads = {};

// Function to send file via Calibrated 10.5 MB/s Chunked Streaming
function sendFile(file) {
    const formattedSize = formatFileSize(file.size);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const filetype = file.type || 'application/octet-stream';

    statusText.textContent = `Streaming "${file.name}" (${formattedSize})...`;

    // Create progress card for sender
    const cardObj = createProgressCard({
        fileId,
        filename: file.name,
        filetype,
        formattedSize,
        direction: 'Sent'
    });

    // Emit header event to server
    socket.emit('file-header', {
        fileId,
        filename: file.name,
        filetype,
        size: file.size,
        formattedSize,
        totalChunks
    });

    let currentChunk = 0;
    let completedChunks = 0;
    const startTime = Date.now();

    function sendNextChunk() {
        if (currentChunk >= totalChunks) return;

        const chunkIndex = currentChunk++;
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const slice = file.slice(start, end);
        const chunkStartTime = Date.now();

        const reader = new FileReader();

        reader.onload = function (e) {
            const chunkData = e.target.result;
            
            socket.emit('file-chunk', {
                fileId,
                chunkIndex,
                totalChunks,
                data: chunkData
            });

            completedChunks++;

            const percent = Math.round((completedChunks / totalChunks) * 100);
            const elapsedSec = (Date.now() - startTime) / 1000;
            const bytesSent = Math.min(completedChunks * CHUNK_SIZE, file.size);
            const currentMBps = elapsedSec > 0 ? ((bytesSent / (1024 * 1024)) / elapsedSec).toFixed(1) : '0.0';

            cardObj.updateProgress(percent, `${currentMBps} MB/s • ${completedChunks}/${totalChunks} chunks`);

            if (completedChunks < totalChunks) {
                const chunkElapsed = Date.now() - chunkStartTime;
                const delay = Math.max(0, TARGET_MS_PER_CHUNK - chunkElapsed);
                setTimeout(sendNextChunk, delay);
            } else {
                statusText.textContent = `Successfully sent "${file.name}"!`;
                cardObj.complete(file);
            }
        };

        reader.onerror = function (err) {
            console.error('Error reading chunk:', err);
            statusText.textContent = `Error sending "${file.name}".`;
        };

        reader.readAsArrayBuffer(slice);
    }

    sendNextChunk();
}

// Socket listener for incoming chunked streaming file headers
socket.on('file-header', (header) => {
    const { fileId, filename, filetype, formattedSize, totalChunks } = header;
    statusText.textContent = `Receiving "${filename}" (${formattedSize})...`;

    const cardObj = createProgressCard({
        fileId,
        filename,
        filetype,
        formattedSize,
        direction: 'Received'
    });

    activeDownloads[fileId] = {
        header,
        chunks: new Array(totalChunks),
        receivedCount: 0,
        startTime: Date.now(),
        cardObj
    };
});

// Socket listener for receiving stream chunks
socket.on('file-chunk', (data) => {
    const { fileId, chunkIndex, totalChunks, data: chunkData } = data;
    const download = activeDownloads[fileId];
    if (!download) return;

    download.chunks[chunkIndex] = chunkData;
    download.receivedCount++;

    const percent = Math.round((download.receivedCount / totalChunks) * 100);
    const elapsedSec = (Date.now() - download.startTime) / 1000;
    const bytesReceived = Math.min(download.receivedCount * CHUNK_SIZE, download.header.size || (totalChunks * CHUNK_SIZE));
    const currentMBps = elapsedSec > 0 ? ((bytesReceived / (1024 * 1024)) / elapsedSec).toFixed(1) : '0.0';

    download.cardObj.updateProgress(percent, `${currentMBps} MB/s • ${download.receivedCount}/${totalChunks} chunks`);

    if (download.receivedCount === totalChunks) {
        const blob = new Blob(download.chunks, { type: download.header.filetype || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);

        // Auto-download via <a>
        downloadLink.href = blobUrl;
        downloadLink.download = download.header.filename;
        downloadLink.click();

        statusText.textContent = `Received and downloaded "${download.header.filename}"!`;
        download.cardObj.complete(blob);

        delete activeDownloads[fileId];
    }
});

// Helper function to create transfer cards with live progress bars
function createProgressCard({ fileId, filename, filetype, formattedSize, direction }) {
    if (emptyState) emptyState.style.display = 'none';
    totalTransfers++;
    itemCount.textContent = `${totalTransfers} item${totalTransfers > 1 ? 's' : ''}`;

    const isImage = filetype && filetype.startsWith('image/');
    const isVideo = filetype && filetype.startsWith('video/');

    const card = document.createElement('div');
    card.className = 'file-card';
    card.id = `card-${fileId}`;

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'thumbnail-wrapper';

    const icon = document.createElement('div');
    icon.className = 'file-icon-placeholder';
    icon.textContent = getFileEmoji(filetype, filename);
    thumbWrapper.appendChild(icon);

    const details = document.createElement('div');
    details.className = 'card-details';

    const headerInfo = document.createElement('div');
    headerInfo.className = 'card-header-info';

    const title = document.createElement('div');
    title.className = 'file-title';
    title.textContent = filename;
    title.title = filename;

    const badge = document.createElement('span');
    badge.className = `direction-badge ${direction === 'Sent' ? 'badge-sent' : 'badge-received'}`;
    badge.textContent = direction;

    headerInfo.appendChild(title);
    headerInfo.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `${formattedSize} • Streaming...`;

    // Progress Bar Elements
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);

    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.innerHTML = `<span>0%</span><span>0 MB</span>`;

    details.appendChild(headerInfo);
    details.appendChild(meta);
    details.appendChild(progressContainer);
    details.appendChild(progressText);

    card.appendChild(thumbWrapper);
    card.appendChild(details);

    fileList.insertBefore(card, fileList.firstChild);

    return {
        updateProgress(percent, statusMsg) {
            progressBar.style.width = `${percent}%`;
            progressText.innerHTML = `<span>${percent}%</span><span>${statusMsg}</span>`;
        },
        complete(blobOrFile) {
            const blobUrl = URL.createObjectURL(blobOrFile);
            
            // Remove progress bar & text
            progressContainer.remove();
            progressText.remove();

            meta.textContent = `${formattedSize} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            // Render Thumbnail / Media Preview if Image or Video
            thumbWrapper.innerHTML = '';
            if (isImage) {
                const img = document.createElement('img');
                img.src = blobUrl;
                img.alt = filename;
                img.className = 'thumbnail-img';
                thumbWrapper.appendChild(img);
                thumbWrapper.addEventListener('click', () => openLightbox(blobUrl, filename));
            } else if (isVideo) {
                const vid = document.createElement('video');
                vid.src = blobUrl;
                vid.controls = true;
                vid.className = 'video-preview';
                thumbWrapper.appendChild(vid);
            } else {
                thumbWrapper.appendChild(icon);
            }

            // Download Button
            const dlBtn = document.createElement('a');
            dlBtn.className = 'btn-download';
            dlBtn.href = blobUrl;
            dlBtn.download = filename;
            dlBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg> Download
            `;
            details.appendChild(dlBtn);
        }
    };
}

// Lightbox modal logic
function openLightbox(imgSrc, title) {
    lightboxImg.src = imgSrc;
    lightboxCaption.textContent = title;
    lightbox.style.display = 'flex';
}

if (lightboxClose) {
    lightboxClose.addEventListener('click', () => {
        lightbox.style.display = 'none';
    });
}

if (lightbox) {
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
        }
    });
}

// Helper to pick file icon
function getFileEmoji(filetype, filename) {
    if (!filetype && !filename) return '📄';
    const ext = filename.split('.').pop().toLowerCase();
    
    if (filetype.startsWith('video/')) return '🎥';
    if (filetype.startsWith('audio/')) return '🎵';
    if (filetype.includes('pdf') || ext === 'pdf') return '📕';
    if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar') return '📦';
    if (ext === 'doc' || ext === 'docx') return '📘';
    if (ext === 'xls' || ext === 'xlsx') return '📊';
    return '📄';
}

// QR Modal DOM elements
const btnQr = document.getElementById('btn-qr');
const qrModal = document.getElementById('qr-modal');
const qrImg = document.getElementById('qr-img');
const qrUrlText = document.getElementById('qr-url-text');
const btnCopyUrl = document.getElementById('btn-copy-url');
const qrClose = document.getElementById('qr-close');

let currentServerUrl = '';

// Toggle QR Modal
if (btnQr) {
    btnQr.addEventListener('click', () => {
        qrModal.style.display = 'flex';
    });
}

if (qrClose) {
    qrClose.addEventListener('click', () => {
        qrModal.style.display = 'none';
    });
}

if (qrModal) {
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
            qrModal.style.display = 'none';
        }
    });
}

// Copy server URL button
if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
        if (currentServerUrl) {
            navigator.clipboard.writeText(currentServerUrl).then(() => {
                btnCopyUrl.textContent = 'Copied!';
                setTimeout(() => {
                    btnCopyUrl.textContent = 'Copy Link';
                }, 2000);
            });
        }
    });
}

// Socket connection status handlers
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

// Server info event with URL & QR Data URL
socket.on('server-info', ({ url, qr }) => {
    currentServerUrl = url;
    if (qrImg) qrImg.src = qr;
    if (qrUrlText) qrUrlText.textContent = url;
});

// Socket listener for initial file history load on connection
socket.on('file-history', (historyList) => {
    // Process items in reverse so oldest is inserted first, newest ends up on top
    historyList.slice().reverse().forEach((data) => {
        const { filename, filetype, filedata } = data;
        const blob = new Blob([filedata], { type: filetype || 'application/octet-stream' });
        const formattedSize = formatFileSize(blob.size);

        addFileCard({
            filename,
            filetype,
            formattedSize,
            blob,
            direction: 'Shared'
        });
    });
});

socket.on('disconnect', () => {
    statusText.textContent = 'Disconnected from server. Retrying...';
});
