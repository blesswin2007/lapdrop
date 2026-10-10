const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Increase Socket.io maxHttpBufferSize to 100GB (1e11 bytes) and disable per-message compression for ultra-fast raw streaming
const io = new Server(server, {
    maxHttpBufferSize: 1e11,
    perMessageDeflate: false
});

// Serve public directory as static files
app.use(express.static(path.join(__dirname, 'public')));

// Function to dynamically fetch local IPv4 address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            // Filter for IPv4 and non-internal addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// In-memory buffer for recent shared files (up to 20 items, max 50MB per stored item)
const fileHistory = [];

// Socket.io logic
io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send server info (URL & QR Code Data URL) to connected client
    try {
        const qrDataUrl = await qrcode.toDataURL(serverUrl, { margin: 2, width: 260 });
        socket.emit('server-info', {
            url: serverUrl,
            qr: qrDataUrl
        });
    } catch (err) {
        console.error('Failed to generate QR Data URL:', err);
    }

    // Send existing session file history to newly connected client
    if (fileHistory.length > 0) {
        socket.emit('file-history', fileHistory);
    }

    // Chunked streaming file transfer logic
    socket.on('file-header', (header) => {
        console.log(`Starting transfer: "${header.filename}" (${header.formattedSize}, ${header.totalChunks} chunks) from ${socket.id}`);
        socket.broadcast.emit('file-header', header);
    });

    socket.on('file-chunk', (chunkData) => {
        socket.broadcast.emit('file-chunk', chunkData);
    });

    // Fallback for smaller single-payload file shares
    socket.on('file-share', (payload) => {
        console.log(`Receiving file "${payload.filename}" from ${socket.id}, broadcasting...`);
        
        const timestampedPayload = {
            ...payload,
            timestamp: new Date().toISOString()
        };

        if (payload.filedata && payload.filedata.byteLength <= 50 * 1024 * 1024) {
            fileHistory.unshift(timestampedPayload);
            if (fileHistory.length > 20) {
                fileHistory.pop();
            }
        }

        socket.broadcast.emit('file-receive', timestampedPayload);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
const localIp = getLocalIpAddress();
const serverUrl = `http://${localIp}:${PORT}`;

server.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(` LapDrop Server is running!`);
    console.log(` Access URL: ${serverUrl}`);
    console.log(`===========================================\n`);
    console.log(`Scan this QR code on your mobile device:\n`);

    qrcode.toString(serverUrl, { type: 'terminal', small: true }, (err, qr) => {
        if (err) {
            console.error('Failed to generate QR code:', err);
        } else {
            console.log(qr);
        }
        console.log(`Waiting for file transfers...\n`);
    });
});
