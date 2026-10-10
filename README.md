# LapDrop ⚡

> **AirDrop-style fast local file & video sharing over Wi-Fi.**  
> Transmit photos, 4K videos, and large files up to 100GB across any device on your local network instantly without cloud uploads.

![LapDrop Banner](https://img.shields.io/badge/License-MIT-blue.svg) ![Node.js](https://img.shields.io/badge/Node.js-v16%2B-green.svg) ![Socket.io](https://img.shields.io/badge/Socket.io-v4-black.svg)

---

## ✨ Features

- ⚡ **Ultra-Fast Calibrated Transfers**: Stream files at **~10.5 MB/s** calibrated Wi-Fi throughput without crashing browser memory.
- 📦 **Supports Files Up to 100GB**: Uses **Chunked Streaming** to transfer giant 4K videos, zip archives, and multi-gigabyte folders.
- 📲 **Instant QR Code Mobile Pairing**: Scan the generated QR code on your phone's camera to connect immediately.
- 🖼️ **Image Gallery & Video Preview**: Visual cards with live transfer progress bars, full-screen image lightbox, and in-browser video playback.
- 🔒 **100% Private & Local**: Files are transferred directly over your Wi-Fi network — no internet access or external cloud servers required.
- 🌐 **Universal Cross-Platform**: Works seamless across **Windows, macOS, Linux, Android, iOS**, or any device with a modern web browser.

---

## 🚀 Quick Start

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v16 or higher) installed on your computer.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/lapdrop.git
   cd lapdrop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the LapDrop server**:
   ```bash
   npm start
   ```

4. **Access LapDrop**:
   - On your computer: Open **`http://localhost:3000`** in your browser.
   - On your mobile device: Scan the QR code displayed in your terminal or click the **`📱 Connect Phone (QR Code)`** button on the web page.

---

## 🛠️ Built With

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism Dark Theme, Outfit font), JavaScript (ES6+)
- **QR Code**: `qrcode` npm module

---

## 📂 Project Structure

```text
lapdrop/
├── public/
│   ├── index.html       # Main Web Application UI
│   ├── style.css        # Modern Glassmorphic Dark Styling
│   └── client.js        # Chunked Streaming & Socket.io Logic
├── server.js            # Express & Socket.io Server
├── package.json         # Project Dependencies
├── .gitignore           # Git Ignored Files
├── LICENSE              # MIT License
└── README.md            # Project Documentation
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/your-username/lapdrop/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
