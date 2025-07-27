# MultiTools - Professional Digital Services Platform

A comprehensive web application offering essential digital tools including video downloading, QR code generation, text-to-speech conversion, and AI-powered background removal.

## 🚀 Live Demo

Visit the live application: [https://multi-tool-yp6r.onrender.com](https://multi-tool-yp6r.onrender.com)

## ✨ Features

- **📺 Video Downloader**: Download videos from YouTube and other platforms
- **🔲 QR Code Generator**: Create customizable QR codes with various options
- **🎙️ Text-to-Speech**: Convert text to natural speech in multiple languages
- **🖼️ Background Remover**: AI-powered background removal from images
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Fast Processing**: Optimized for quick file processing and downloads

## 🛠️ Technology Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **AI/ML**: rembg (background removal), gTTS (text-to-speech)
- **Media Processing**: yt-dlp (video downloading), qrcode (QR generation)
- **Deployment**: Render.com compatible

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/itsalam149/multi-tool.git
   cd multi-tool
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   python main.py
   ```

5. **Open your browser**
   Navigate to `http://localhost:10000`

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application interface |
| `/health` | GET | Health check endpoint |
| `/api/download-video` | POST | Download video from URL |
| `/api/generate-qr` | POST | Generate QR code |
| `/api/text-to-speech` | POST | Convert text to speech |
| `/api/remove-background` | POST | Remove image background |

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 10000)
- `ENVIRONMENT`: deployment environment (development/production)

### File Limits

- **Images**: 10MB maximum
- **Text-to-Speech**: 5000 characters maximum
- **QR Code Text**: 2000 characters maximum

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or need support:

1. Check the [Issues](https://github.com/itsalam149/multi-tool/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce the problem

## 🔮 Roadmap

- [ ] User accounts and file history
- [ ] Batch processing capabilities
- [ ] API rate limiting
- [ ] Additional video platforms support
- [ ] More TTS voice options
- [ ] Custom QR code styling

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Built with ❤️ by [Alam Siddiqui](https://github.com/itsalam149)**