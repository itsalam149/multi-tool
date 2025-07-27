// MultiTools JavaScript - Professional SaaS Application
// API Configuration
const API_BASE = 'http://localhost:8000';

// Global state management
const state = {
    activeModal: null,
    processingTasks: new Set(),
    results: new Map()
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

// Main initialization function
function initializeApp() {
    createParticles();
    setupEventListeners();
    setupFileUpload();
    setupFormValidation();
    initializeToastSystem();
}

// Particle animation system
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    // Clear existing particles
    particlesContainer.innerHTML = '';

    const particleCount = window.innerWidth < 768 ? 30 : 60;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random positioning
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';

        // Random animation timing
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 4) + 's';

        // Random opacity
        particle.style.opacity = Math.random() * 0.5 + 0.3;

        particlesContainer.appendChild(particle);
    }
}

// Event listeners setup
function setupEventListeners() {
    // Modal close on escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.activeModal) {
            closeModal(state.activeModal);
        }
    });

    // Range input updates
    const qrSizeInput = document.getElementById('qr-size');
    if (qrSizeInput) {
        qrSizeInput.addEventListener('input', function () {
            document.getElementById('size-display').textContent = this.value;
        });
    }

    // Text area character counting
    const ttsTextArea = document.getElementById('tts-text');
    if (ttsTextArea) {
        ttsTextArea.addEventListener('input', function () {
            const charCount = this.value.length;
            const maxLength = 5000;
            const counter = this.closest('.form-group').querySelector('.char-count');
            if (counter) {
                counter.textContent = `${charCount} / ${maxLength} characters`;
                counter.style.color = charCount > maxLength ? 'var(--error)' : 'var(--text-muted)';
            }
        });
    }

    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Resize event for particles
    window.addEventListener('resize', debounce(createParticles, 250));
}

// File upload setup
function setupFileUpload() {
    const fileUpload = document.getElementById('file-upload');
    const fileInput = document.getElementById('bg-file');
    const filePreview = document.getElementById('file-preview');

    if (!fileUpload || !fileInput) return;

    // Click to upload
    fileUpload.addEventListener('click', () => fileInput.click());

    // Drag and drop functionality
    fileUpload.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.style.borderColor = 'var(--primary)';
        this.style.background = 'var(--surface-lighter)';
    });

    fileUpload.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.style.borderColor = 'var(--border-light)';
        this.style.background = 'transparent';
    });

    fileUpload.addEventListener('drop', function (e) {
        e.preventDefault();
        this.style.borderColor = 'var(--border-light)';
        this.style.background = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            handleFileSelection(this.files[0]);
        }
    });
}

// Handle file selection and preview
function handleFileSelection(file) {
    const filePreview = document.getElementById('file-preview');
    const fileUpload = document.getElementById('file-upload');
    const previewImg = document.getElementById('preview-img');
    const previewName = document.getElementById('preview-name');
    const previewSize = document.getElementById('preview-size');

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = function (e) {
        previewImg.src = e.target.result;
        previewName.textContent = file.name;
        previewSize.textContent = formatFileSize(file.size);

        fileUpload.style.display = 'none';
        filePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// Remove file selection
function removeFile() {
    const fileInput = document.getElementById('bg-file');
    const filePreview = document.getElementById('file-preview');
    const fileUpload = document.getElementById('file-upload');

    fileInput.value = '';
    fileUpload.style.display = 'block';
    filePreview.style.display = 'none';
}

// Form validation setup
function setupFormValidation() {
    // Real-time validation for URL inputs
    const urlInputs = document.querySelectorAll('input[type="url"]');
    urlInputs.forEach(input => {
        input.addEventListener('blur', function () {
            validateUrl(this);
        });
    });

    // Required field validation
    const requiredInputs = document.querySelectorAll('input[required], textarea[required]');
    requiredInputs.forEach(input => {
        input.addEventListener('blur', function () {
            validateRequired(this);
        });
    });
}

// Modal management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Close any existing modal
    if (state.activeModal) {
        closeModal(state.activeModal);
    }

    modal.classList.add('active');
    state.activeModal = modalId;
    document.body.style.overflow = 'hidden';

    // Focus first input
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }

    // Reset form and results
    resetModalContent(modalId);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('active');
    state.activeModal = null;
    document.body.style.overflow = '';

    // Reset form
    const form = modal.querySelector('.service-form');
    if (form) {
        form.reset();
    }

    // Hide results and loading
    hideLoading(modalId.replace('-modal', ''));
    hideResult(modalId.replace('-modal', ''));
}

function resetModalContent(modalId) {
    const serviceId = modalId.replace('-modal', '');
    hideLoading(serviceId);
    hideResult(serviceId);

    // Reset file upload if background remover
    if (serviceId === 'bg') {
        removeFile();
    }

    // Reset character counter
    const charCounter = document.querySelector('.char-count');
    if (charCounter) {
        charCounter.textContent = '0 / 5000 characters';
        charCounter.style.color = 'var(--text-muted)';
    }
}

// Loading state management
function showLoading(serviceId) {
    const loadingOverlay = document.getElementById(serviceId + '-loading');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
        state.processingTasks.add(serviceId);
    }
}

function hideLoading(serviceId) {
    const loadingOverlay = document.getElementById(serviceId + '-loading');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        state.processingTasks.delete(serviceId);
    }
}

// Result management
function showResult(serviceId, content, type = 'success') {
    const resultSection = document.getElementById(serviceId + '-result');
    if (!resultSection) return;

    resultSection.className = `result-section active`;
    resultSection.innerHTML = `
        <div class="result-${type}">
            ${content}
        </div>
    `;

    // Store result in state
    state.results.set(serviceId, { content, type, timestamp: Date.now() });

    // Scroll to result
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideResult(serviceId) {
    const resultSection = document.getElementById(serviceId + '-result');
    if (resultSection) {
        resultSection.classList.remove('active');
        state.results.delete(serviceId);
    }
}

// Service implementations
async function processVideo() {
    const url = document.getElementById('video-url').value.trim();
    const qualityRadio = document.querySelector('input[name="quality"]:checked');
    const quality = qualityRadio ? qualityRadio.value : 'best';

    // Validation
    if (!url) {
        showToast('Please enter a video URL', 'error');
        return;
    }

    if (!validateUrl(document.getElementById('video-url'))) {
        return;
    }

    showLoading('video');

    try {
        const response = await fetch(`${API_BASE}/api/download-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, quality })
        }); 

        hideLoading('video');

        if (response.ok) {
            const blob = await response.blob();
            const filename = `video_${Date.now()}.mp4`;

            // Show success result with download button
            showResult('video', `
                <div class="result-content">
                    <div class="result-preview">
                        <i class="fas fa-video" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                        <h4>Video processed successfully!</h4>
                        <p>Your video is ready for download</p>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-primary" onclick="downloadBlob('${URL.createObjectURL(blob)}', '${filename}')">
                            <i class="fas fa-download"></i>
                            Download Video
                        </button>
                        <button class="btn btn-secondary" onclick="processVideo()">
                            <i class="fas fa-redo"></i>
                            Process Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Video processed successfully!', 'success');
        } else {
            const error = await response.json();
            showResult('video', `
                <div class="result-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Processing Failed:</strong> ${error.detail || 'Unknown error occurred'}
                </div>
            `, 'error');
            showToast('Video processing failed', 'error');
        }
    } catch (error) {
        hideLoading('video');
        showResult('video', `
            <div class="result-error">
                <i class="fas fa-wifi"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Network error occurred', 'error');
    }
}

async function generateQR() {
    const text = document.getElementById('qr-text').value.trim();
    const size = parseInt(document.getElementById('qr-size').value);
    const errorCorrection = document.getElementById('qr-error-correction').value;

    // Validation
    if (!text) {
        showToast('Please enter content for the QR code', 'error');
        return;
    }

    if (text.length > 2000) {
        showToast('Content is too long (max 2000 characters)', 'error');
        return;
    }

    showLoading('qr');

    try {
        const response = await fetch(`${API_BASE}/api/generate-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                size,
                error_correction: errorCorrection
            })
        });

        hideLoading('qr');

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            const filename = `qrcode_${Date.now()}.png`;

            // Show success result with preview and download
            showResult('qr', `
                <div class="result-content">
                    <div class="result-preview">
                        <img src="${imageUrl}" alt="Generated QR Code" style="max-width: 250px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg);">
                        <h4 style="margin-top: 1rem;">QR Code Generated!</h4>
                        <p>Size: ${size} | Error Correction: ${errorCorrection}</p>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-primary" onclick="downloadBlob('${imageUrl}', '${filename}')">
                            <i class="fas fa-download"></i>
                            Download PNG
                        </button>
                        <button class="btn btn-secondary" onclick="generateQR()">
                            <i class="fas fa-redo"></i>
                            Generate Another
                        </button>
                    </div>
                </div>
            `);

            showToast('QR code generated successfully!', 'success');

            // Clean up URL after 5 minutes
            setTimeout(() => URL.revokeObjectURL(imageUrl), 300000);
        } else {
            const error = await response.json();
            showResult('qr', `
                <div class="result-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Generation Failed:</strong> ${error.detail || 'Unknown error occurred'}
                </div>
            `, 'error');
            showToast('QR code generation failed', 'error');
        }
    } catch (error) {
        hideLoading('qr');
        showResult('qr', `
            <div class="result-error">
                <i class="fas fa-wifi"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Network error occurred', 'error');
    }
}

async function textToSpeech() {
    const text = document.getElementById('tts-text').value.trim();
    const language = document.getElementById('tts-language').value;
    const voice = document.getElementById('tts-voice').value;
    const slow = document.getElementById('tts-slow').checked;

    // Validation
    if (!text) {
        showToast('Please enter text to convert', 'error');
        return;
    }

    if (text.length > 5000) {
        showToast('Text is too long (max 5000 characters)', 'error');
        return;
    }

    showLoading('tts');

    try {
        const response = await fetch(`${API_BASE}/api/text-to-speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                language,
                voice_style: voice,
                slow
            })
        });

        hideLoading('tts');

        if (response.ok) {
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const filename = `speech_${Date.now()}.mp3`;

            // Show success result with audio player and download
            showResult('tts', `
                <div class="result-content">
                    <div class="result-preview">
                        <i class="fas fa-volume-up" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                        <h4>Speech Generated!</h4>
                        <p>Language: ${getLanguageName(language)} | Voice: ${voice}</p>
                        <audio controls style="width: 100%; margin: 1rem 0; border-radius: var(--radius-md);">
                            <source src="${audioUrl}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-primary" onclick="downloadBlob('${audioUrl}', '${filename}')">
                            <i class="fas fa-download"></i>
                            Download MP3
                        </button>
                        <button class="btn btn-secondary" onclick="textToSpeech()">
                            <i class="fas fa-redo"></i>
                            Generate Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Speech generated successfully!', 'success');

            // Clean up URL after 10 minutes
            setTimeout(() => URL.revokeObjectURL(audioUrl), 600000);
        } else {
            const error = await response.json();
            showResult('tts', `
                <div class="result-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Generation Failed:</strong> ${error.detail || 'Unknown error occurred'}
                </div>
            `, 'error');
            showToast('Speech generation failed', 'error');
        }
    } catch (error) {
        hideLoading('tts');
        showResult('tts', `
            <div class="result-error">
                <i class="fas fa-wifi"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Network error occurred', 'error');
    }
}

async function removeBackground() {
    const fileInput = document.getElementById('bg-file');
    const file = fileInput.files[0];
    const smoothEdges = document.getElementById('bg-smooth-edges').checked;
    const highQuality = document.getElementById('bg-high-quality').checked;

    // Validation
    if (!file) {
        showToast('Please select an image file', 'error');
        return;
    }

    showLoading('bg');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('smooth_edges', smoothEdges);
        formData.append('high_quality', highQuality);

        const response = await fetch(`${API_BASE}/api/remove-background`, {
            method: 'POST',
            body: formData
        });

        hideLoading('bg');

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            const filename = `no_bg_${file.name.replace(/\.[^/.]+$/, '')}.png`;

            // Show success result with before/after comparison
            const originalUrl = URL.createObjectURL(file);
            showResult('bg', `
                <div class="result-content">
                    <h4 style="margin-bottom: 1rem;">Background Removed Successfully!</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div style="text-align: center;">
                            <p style="margin-bottom: 0.5rem; font-weight: 600;">Original</p>
                            <img src="${originalUrl}" style="max-width: 100%; border-radius: var(--radius-md); box-shadow: var(--shadow-md);">
                        </div>
                        <div style="text-align: center;">
                            <p style="margin-bottom: 0.5rem; font-weight: 600;">Processed</p>
                            <img src="${imageUrl}" style="max-width: 100%; border-radius: var(--radius-md); box-shadow: var(--shadow-md); background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;">
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-primary" onclick="downloadBlob('${imageUrl}', '${filename}')">
                            <i class="fas fa-download"></i>
                            Download PNG
                        </button>
                        <button class="btn btn-secondary" onclick="removeBackground()">
                            <i class="fas fa-redo"></i>
                            Process Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Background removed successfully!', 'success');

            // Clean up URLs after 10 minutes
            setTimeout(() => {
                URL.revokeObjectURL(imageUrl);
                URL.revokeObjectURL(originalUrl);
            }, 600000);
        } else {
            const error = await response.json();
            showResult('bg', `
                <div class="result-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Processing Failed:</strong> ${error.detail || 'Unknown error occurred'}
                </div>
            `, 'error');
            showToast('Background removal failed', 'error');
        }
    } catch (error) {
        hideLoading('bg');
        showResult('bg', `
            <div class="result-error">
                <i class="fas fa-wifi"></i>
                <strong>Connection Error:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Network error occurred', 'error');
    }
}

// Utility functions
function downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('Download started!', 'success');
}

function validateUrl(input) {
    const url = input.value.trim();
    if (!url) return false;

    try {
        new URL(url);
        input.style.borderColor = 'var(--success)';
        return true;
    } catch {
        input.style.borderColor = 'var(--error)';
        showToast('Please enter a valid URL', 'error');
        return false;
    }
}

function validateRequired(input) {
    const value = input.value.trim();
    if (!value) {
        input.style.borderColor = 'var(--error)';
        return false;
    } else {
        input.style.borderColor = 'var(--border)';
        return true;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getLanguageName(code) {
    const languages = {
        'en': 'English (US)',
        'en-gb': 'English (UK)',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
    };
    return languages[code] || code;
}

function scrollToServices() {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Toast notification system
let toastContainer;

function initializeToastSystem() {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

function showToast(message, type = 'info', duration = 4000) {
    if (!toastContainer) initializeToastSystem();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
    };

    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">
                <i class="${icons[type]}"></i>
                ${titles[type]}
            </span>
            <button class="toast-close" onclick="removeToast(this.parentElement.parentElement)">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-message">${message}</div>
    `;

    toastContainer.appendChild(toast);

    // Auto remove
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

function removeToast(toast) {
    if (toast && toast.parentElement) {
        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }
}

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// Service worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// Export functions for global access
window.openModal = openModal;
window.closeModal = closeModal;
window.processVideo = processVideo;
window.generateQR = generateQR;
window.textToSpeech = textToSpeech;
window.removeBackground = removeBackground;
window.removeFile = removeFile;
window.downloadBlob = downloadBlob;
window.scrollToServices = scrollToServices;