/**
 * Waveform Visualization Manager
 * Handles real audio decoding (CORS dependent) and seeded pseudo-waveform generation.
 * Renders as a smooth linear area graph with fade-in animation.
 */

export class Waveform {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');

        this.data = []; // Normalized height data (0.0 - 1.0)
        this.targetData = []; // For smooth data transition (optional future use)

        this.progress = 0; // 0.0 - 1.0
        this.duration = 0;

        this.colorActiveStart = '#1db954'; // Accent color top
        this.colorActiveEnd = 'rgba(29, 185, 84, 0.1)'; // Accent color bottom
        this.colorPassive = 'rgba(255, 255, 255, 0.1)';

        this.opacity = 0;
        this.targetOpacity = 0;
        this.animationFrame = null;

        this.animationFrame = null;

        // Re-use global context or create new
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        this.currentUrl = null;
        this.isGenerating = false;

        this.initListners();
        this.resize();
        this.startAnimationLoop();

        // Seeded Random Helper
        this.seededRandom = (seed) => {
            let value = seed % 233280;
            return () => {
                value = (value * 9301 + 49297) % 233280;
                return value / 233280;
            };
        };
    }

    /**
     * Set dynamic color for waveform with transition
     * @param {string} hex - Hex color code (e.g., '#1db954')
     */
    setColor(hex) {
        // Parse hex to RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const targetColor = { r, g, b };
        const startColor = this.currentColor || { r: 29, g: 185, b: 84 }; // Default green

        // Simple tween loop for color (updates every frame in render, but we need to store state)
        // Actually, easier to just update CSS-like if we redraw constantly.
        // Let's store target and lerp in render loop or a separate transition loop.

        this.targetColor = targetColor;

        if (!this.currentColor) {
            this.currentColor = { ...targetColor };
            this.colorActiveStart = hex;
            this.colorActiveEnd = `rgba(${r}, ${g}, ${b}, 0.1)`;
        }
        // If we already have a loop running, it will pick up targetColor
    }

    initListners() {
        window.addEventListener('resize', () => {
            this.resize();
            // render will be called by animation loop
        });

        // Click to seek
        if (this.container) {
            this.container.onclick = (e) => {
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = Math.max(0, Math.min(1, x / rect.width));

                if (this.onSeek) {
                    this.onSeek(percent);
                }
            };

            // Drag support
            let isDragging = false;

            this.container.onmousedown = () => isDragging = true;
            document.onmouseup = () => isDragging = false;

            this.container.onmousemove = (e) => {
                if (!isDragging) return;
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = Math.max(0, Math.min(1, x / rect.width));

                if (this.onSeek) {
                    this.onSeek(percent);
                }
            };
        }
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();

        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    startAnimationLoop() {
        const loop = () => {
            // Smooth Opacity Transition
            const diff = this.targetOpacity - this.opacity;
            if (Math.abs(diff) > 0.01) {
                this.opacity += diff * 0.1;
            } else {
                this.opacity = this.targetOpacity;
            }

            // Smooth Data Transition (Rise Up Effect)
            if (this.targetData.length > 0) {
                // Resize active data if needed
                if (this.data.length !== this.targetData.length) {
                    this.data = new Array(this.targetData.length).fill(0);
                }

                // Interpolate
                let dataChanged = false;
                for (let i = 0; i < this.targetData.length; i++) {
                    const dDiff = this.targetData[i] - this.data[i];
                    if (Math.abs(dDiff) > 0.001) {
                        this.data[i] += dDiff * 0.15; // Animation speed
                        dataChanged = true;
                    } else {
                        this.data[i] = this.targetData[i];
                    }
                }
            }


            // Smooth Color Transition
            if (this.targetColor && this.currentColor) {
                const lerp = (start, end, amt) => (1 - amt) * start + amt * end;
                const speed = 0.05;

                let changed = false;
                if (Math.abs(this.currentColor.r - this.targetColor.r) > 1) {
                    this.currentColor.r = lerp(this.currentColor.r, this.targetColor.r, speed);
                    changed = true;
                }
                if (Math.abs(this.currentColor.g - this.targetColor.g) > 1) {
                    this.currentColor.g = lerp(this.currentColor.g, this.targetColor.g, speed);
                    changed = true;
                }
                if (Math.abs(this.currentColor.b - this.targetColor.b) > 1) {
                    this.currentColor.b = lerp(this.currentColor.b, this.targetColor.b, speed);
                    changed = true;
                }

                if (changed) {
                    const r = Math.round(this.currentColor.r);
                    const g = Math.round(this.currentColor.g);
                    const b = Math.round(this.currentColor.b);
                    this.colorActiveStart = `rgb(${r}, ${g}, ${b})`;
                    this.colorActiveEnd = `rgba(${r}, ${g}, ${b}, 0.1)`;
                }
            }

            this.render();
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    }

    /**
     * Load waveform data
     * @param {string} url - Audio URL
     * @param {string|number} id - Song ID (for seeding fallback)
     */
    async load(url, id) {
        if (this.currentUrl === url) return;
        this.currentUrl = url;

        // ANIMATION STEP 1: SINK
        // Keep active (opacity 1) so we see the bars sinking
        this.targetOpacity = 1;

        if (this.data.length > 0) {
            // Trigger sink: target all zeros
            this.targetData = new Array(this.data.length).fill(0);
        }

        // Wait for sink animation to be visible (250ms matches approx transition speed)
        await new Promise(r => setTimeout(r, 250));

        this.isGenerating = true;

        // 1. Try to fetch and decode real audio (Limited by CORS)
        try {
            console.log('Waveform: Attempting to fetch real audio data from:', url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();

            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.targetData = this.processAudioBuffer(audioBuffer);
            console.log('Waveform: Real audio data loaded.');

        } catch (e) {
            console.warn('Waveform: Failed to load real audio (likely CORS or Network), using fallback.', e);
            // 2. Fallback: Generate pseudo-waveform based on ID
            this.targetData = this.generatePseudoWaveform(id);
        } finally {
            this.isGenerating = false;

            // Prepare for rise animation:
            // Ensure data is zeroed out to start fresh rise
            if (this.targetData.length > 0) {
                this.data = new Array(this.targetData.length).fill(0);
            }

            // Fade in new
            this.targetOpacity = 1;
        }
    }

    /**
     * Process real audio buffer to get peaks
     */
    processAudioBuffer(buffer) {
        const rawData = buffer.getChannelData(0); // Use first channel
        const samples = 800; // Increased samples for smoother line
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];

        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
        }

        // Normalize
        const maxVal = Math.max(...filteredData) || 1;
        const multiplier = 1 / maxVal;
        const normalized = filteredData.map(n => n * multiplier);

        return this.smoothData(normalized);
    }

    /**
     * Generate seeded random waveform
     */
    generatePseudoWaveform(id) {
        const samples = 800;
        const data = [];
        // Convert ID to a numeric seed
        const seed = typeof id === 'string'
            ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            : id;

        const random = this.seededRandom(seed);

        // Generate Perlin-like noise (smoothing)
        let y = random();
        for (let i = 0; i < samples; i++) {
            // Smooth random walk
            y += (random() - 0.5) * 0.1; // Even less volatility for smoothness
            y = Math.max(0.1, Math.min(0.9, y)); // Clamp
            data.push(y);
        }

        // Enhance Envelope
        const len = data.length;
        for (let i = 0; i < len; i++) {
            // Fade in first 10%, fade out last 10%
            let envelope = 1;
            if (i < len * 0.1) envelope = i / (len * 0.1);
            else if (i > len * 0.9) envelope = (len - i) / (len * 0.1);

            // Squash the bottom to make peaks stand out more
            data[i] = Math.pow(data[i] * envelope, 1.5);
        }

        return this.smoothData(data);
    }

    /**
     * Apply moving average smoothing
     */
    smoothData(data) {
        const smoothed = [];
        const kernelSize = 5; // Window size
        const len = data.length;

        for (let i = 0; i < len; i++) {
            let sum = 0;
            let count = 0;

            for (let j = -Math.floor(kernelSize / 2); j <= Math.floor(kernelSize / 2); j++) {
                const idx = i + j;
                if (idx >= 0 && idx < len) {
                    sum += data[idx];
                    count++;
                }
            }
            smoothed.push(sum / count);
        }
        return smoothed;
    }

    updateProgress(currentTime, duration) {
        this.duration = duration;
        if (duration > 0) {
            this.progress = currentTime / duration;
        } else {
            this.progress = 0;
        }
        // render handled by loop
    }

    render() {
        if (!this.ctx || !this.width || !this.height) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.opacity <= 0.01) return;

        this.ctx.globalAlpha = this.opacity;

        if (this.data.length === 0) {
            // Loading state line
            this.ctx.globalAlpha = 1; // Always show loading indicator if generating
            if (this.isGenerating) {
                this.ctx.fillStyle = this.colorPassive;
                this.ctx.fillRect(0, this.height - 2, this.width, 2);
            }
            return;
        }

        const totalPoints = this.data.length;
        const step = this.width / (totalPoints - 1);

        // Create Gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, this.colorActiveStart);
        gradient.addColorStop(1, this.colorActiveEnd);

        // --- Render Background (Passive) ---
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);

        // Start point
        let startHeight = this.data[0] * this.height * 0.8;
        this.ctx.lineTo(0, this.height - startHeight);

        for (let i = 0; i < totalPoints - 1; i++) {
            const x = i * step;
            const nextX = (i + 1) * step;

            const h1 = this.data[i] * this.height * 0.8;
            const h2 = this.data[i + 1] * this.height * 0.8;

            const y1 = this.height - h1;
            const y2 = this.height - h2;

            const xc = (x + nextX) / 2;
            const yc = (y1 + y2) / 2;

            this.ctx.quadraticCurveTo(x, y1, xc, yc);
        }

        // Last point
        const lastHeight = this.data[totalPoints - 1] * this.height * 0.8;
        this.ctx.lineTo(this.width, this.height - lastHeight);

        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();
        this.ctx.fillStyle = this.colorPassive;
        this.ctx.fill();

        // --- Render Active Part (Masked or Re-drawn) ---
        // Simple Clip approach:
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.width * this.progress, this.height);
        this.ctx.clip();

        // Draw same shape again with active color
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);

        this.ctx.lineTo(0, this.height - startHeight);

        for (let i = 0; i < totalPoints - 1; i++) {
            const x = i * step;
            const nextX = (i + 1) * step;

            const h1 = this.data[i] * this.height * 0.8;
            const h2 = this.data[i + 1] * this.height * 0.8;

            const y1 = this.height - h1;
            const y2 = this.height - h2;

            const xc = (x + nextX) / 2;
            const yc = (y1 + y2) / 2;

            this.ctx.quadraticCurveTo(x, y1, xc, yc);
        }

        this.ctx.lineTo(this.width, this.height - lastHeight);

        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        this.ctx.restore();

        this.ctx.globalAlpha = 1;
    }
}

