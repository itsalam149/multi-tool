// MultiTools JavaScript - Production Ready
// Dynamic API Configuration
const getApiBase = () => {
    // Use current origin in production, localhost for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:10000';
    }
    return window.location.origin;
};

const API_BASE = getApiBase();

// Global state management
const state = {
    activeModal: null,
    processingTasks: new Set(),
    results: new Map()
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    testConnection();
});

// Test API connection on load
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            console.log('✅ API connection successful');
        } else {
            console.warn('⚠️ API connection issues');
            showToast('Service connection issues detected', 'warning');
        }
    } catch (error) {
        console.error('❌ API connection failed:', error);
        showToast('Unable to connect to services', 'error');
    }
}

// Main initialization function
function initializeApp() {
    createParticles();
    setupEventListeners();
    setupFileUpload();
    setupFormValidation();
    initializeToastSystem();
}

// Enhanced error handling for API calls
async function makeApiCall(endpoint, options = {}) {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            return response;
        } catch (error) {
            retries++;
            console.error(`API call failed (attempt ${retries}):`, error);

            if (retries === maxRetries) {
                throw error;
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
    }
}

// Service functions
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
        const response = await makeApiCall('/api/download-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, quality })
        });

        hideLoading('video');

        if (response.ok) {
            const blob = await response.blob();
            const filename = `video_${Date.now()}.mp4`;

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
                        <button class="btn btn-secondary" onclick="document.getElementById('video-url').value=''; hideResult('video');">
                            <i class="fas fa-redo"></i>
                            Process Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Video processed successfully!', 'success');
        }
    } catch (error) {
        hideLoading('video');
        showResult('video', `
            <div class="result-error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Processing Failed:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Video processing failed: ' + error.message, 'error');
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
        const response = await makeApiCall('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                size,
                border: 4
            })
        });

        hideLoading('qr');

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            const filename = `qrcode_${Date.now()}.png`;

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
                        <button class="btn btn-secondary" onclick="document.getElementById('qr-text').value=''; hideResult('qr');">
                            <i class="fas fa-redo"></i>
                            Generate Another
                        </button>
                    </div>
                </div>
            `);

            showToast('QR code generated successfully!', 'success');
            setTimeout(() => URL.revokeObjectURL(imageUrl), 300000);
        }
    } catch (error) {
        hideLoading('qr');
        showResult('qr', `
            <div class="result-error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Generation Failed:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('QR code generation failed: ' + error.message, 'error');
    }
}

async function textToSpeech() {
    const text = document.getElementById('tts-text').value.trim();
    const language = document.getElementById('tts-language').value;
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
        const response = await makeApiCall('/api/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                language,
                slow
            })
        });

        hideLoading('tts');

        if (response.ok) {
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const filename = `speech_${Date.now()}.mp3`;

            showResult('tts', `
                <div class="result-content">
                    <div class="result-preview">
                        <i class="fas fa-volume-up" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                        <h4>Speech Generated!</h4>
                        <p>Language: ${getLanguageName(language)}</p>
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
                        <button class="btn btn-secondary" onclick="document.getElementById('tts-text').value=''; hideResult('tts');">
                            <i class="fas fa-redo"></i>
                            Generate Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Speech generated successfully!', 'success');
            setTimeout(() => URL.revokeObjectURL(audioUrl), 600000);
        }
    } catch (error) {
        hideLoading('tts');
        showResult('tts', `
            <div class="result-error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Generation Failed:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Speech generation failed: ' + error.message, 'error');
    }
}

async function removeBackground() {
    const fileInput = document.getElementById('bg-file');
    const file = fileInput.files[0];

    // Validation
    if (!file) {
        showToast('Please select an image file', 'error');
        return;
    }

    showLoading('bg');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await makeApiCall('/api/remove-background', {
            method: 'POST',
            body: formData
        });

        hideLoading('bg');

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            const filename = `no_bg_${file.name.replace(/\.[^/.]+$/, '')}.png`;
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
                        <button class="btn btn-secondary" onclick="removeFile(); hideResult('bg');">
                            <i class="fas fa-redo"></i>
                            Process Another
                        </button>
                    </div>
                </div>
            `);

            showToast('Background removed successfully!', 'success');
            setTimeout(() => {
                URL.revokeObjectURL(imageUrl);
                URL.revokeObjectURL(originalUrl);
            }, 600000);
        }
    } catch (error) {
        hideLoading('bg');
        showResult('bg', `
            <div class="result-error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Processing Failed:</strong> ${error.message}
            </div>
        `, 'error');
        showToast('Background removal failed: ' + error.message, 'error');
    }
}

// Utility functions
function scrollToServices() {
    document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    state.activeModal = modalId;
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    state.activeModal = null;
    document.body.style.overflow = '';
}

function showLoading(serviceId) {
    const overlay = document.getElementById(`${serviceId}-loading`);
    overlay.classList.add('active');
}

function hideLoading(serviceId) {
    const overlay = document.getElementById(`${serviceId}-loading`);
    overlay.classList.remove('active');
}

function showResult(serviceId, content, type = 'success') {
    const result = document.getElementById(`${serviceId}-result`);
    result.innerHTML = content;
    result.className = `result-section active ${type}`;
}

function hideResult(serviceId) {
    const result = document.getElementById(`${serviceId}-result`);
    result.classList.remove('active');
}

function downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-message">${message}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        container.appendChild(particle);
    }
}

function validateUrl(input) {
    try {
        new URL(input.value);
        return true;
    } catch {
        showToast('Please enter a valid URL', 'error');
        return false;
    }
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
    return languages[code] || 'Unknown';
}

function setupFileUpload() {
    const fileInput = document.getElementById('bg-file');
    const fileUpload = document.getElementById('file-upload');

    if (fileUpload && fileInput) {
        fileUpload.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);

        // Drag and drop functionality
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.style.borderColor = 'var(--primary)';
            fileUpload.style.background = 'var(--surface-lighter)';
        });

        fileUpload.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileUpload.style.borderColor = 'var(--border-light)';
            fileUpload.style.background = '';
        });

        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.style.borderColor = 'var(--border-light)';
            fileUpload.style.background = '';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect({ target: { files } });
            }
        });
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }

    const preview = document.getElementById('file-preview');
    const img = document.getElementById('preview-img');
    const name = document.getElementById('preview-name');
    const size = document.getElementById('preview-size');

    if (preview && img && name && size) {
        img.src = URL.createObjectURL(file);
        name.textContent = file.name;
        size.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        preview.style.display = 'flex';
    }
}

function removeFile() {
    const fileInput = document.getElementById('bg-file');
    const preview = document.getElementById('file-preview');
    const img = document.getElementById('preview-img');

    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    if (img && img.src) {
        URL.revokeObjectURL(img.src);
        img.src = '';
    }
}

function setupEventListeners() {
    // Range input for QR size
    const sizeRange = document.getElementById('qr-size');
    const sizeDisplay = document.getElementById('size-display');
    if (sizeRange && sizeDisplay) {
        sizeRange.addEventListener('input', () => {
            sizeDisplay.textContent = sizeRange.value;
        });
    }

    // Character counter for TTS
    const ttsText = document.getElementById('tts-text');
    const charCount = document.querySelector('.char-count');
    if (ttsText && charCount) {
        ttsText.addEventListener('input', () => {
            const count = ttsText.value.length;
            charCount.textContent = `${count} / 5000 characters`;
            if (count > 5000) {
                charCount.style.color = 'var(--error)';
            } else {
                charCount.style.color = 'var(--text-muted)';
            }
        });
    }

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.activeModal) {
            closeModal(state.activeModal);
        }
    });

    // Mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
}

function setupFormValidation() {
    // Add real-time validation for forms
    const forms = document.querySelectorAll('.service-form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.addEventListener('blur', validateInput);
            input.addEventListener('input', clearValidationError);
        });
    });
}

function validateInput(event) {
    const input = event.target;
    const value = input.value.trim();

    // Clear previous errors
    clearValidationError(event);

    // Validate based on input type and requirements
    if (input.hasAttribute('required') && !value) {
        showInputError(input, 'This field is required');
        return false;
    }

    if (input.type === 'url' && value && !validateUrl(input)) {
        showInputError(input, 'Please enter a valid URL');
        return false;
    }

    return true;
}

function showInputError(input, message) {
    input.style.borderColor = 'var(--error)';
    let errorEl = input.parentNode.querySelector('.input-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'input-error';
        errorEl.style.color = 'var(--error)';
        errorEl.style.fontSize = '0.875rem';
        errorEl.style.marginTop = '0.25rem';
        input.parentNode.appendChild(errorEl);
    }
    errorEl.textContent = message;
}

function clearValidationError(event) {
    const input = event.target;
    input.style.borderColor = '';
    const errorEl = input.parentNode.querySelector('.input-error');
    if (errorEl) {
        errorEl.remove();
    }
}

function initializeToastSystem() {
    // Toast system is initialized through showToast function
    console.log('Toast system ready');
}

// Initialize smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Performance optimization: Debounce resize events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Handle resize events here if needed
        console.log('Window resized');
    }, 250);
});

// Clean up object URLs on page unload
window.addEventListener('beforeunload', () => {
    // Clean up any remaining object URLs
    const images = document.querySelectorAll('img[src^="blob:"]');
    images.forEach(img => URL.revokeObjectURL(img.src));
});