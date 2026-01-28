/**
 * Real-time Audio Visualizer
 * Renders frequency data from Web Audio API AnalyserNode
 */

export class Visualizer {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;
        this.isActive = false;
        this.animationId = null;

        // Configuration
        this.fftSize = 256; // 128 data points
        this.barWidth = 4;
        this.barGap = 2;
        this.color = '#ffffff';
        this.baseRadius = 100;

        // Data buffer
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        // Handle resize
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;

        // Adjust radius based on screen size
        this.baseRadius = Math.min(this.width, this.height) * 0.15;
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.draw();

        // Smooth fade in
        this.canvas.style.opacity = '0';
        requestAnimationFrame(() => {
            this.canvas.style.opacity = '1';
        });
    }

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.canvas.style.opacity = '0';
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    draw() {
        if (!this.isActive) return;

        this.animationId = requestAnimationFrame(() => this.draw());

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw logic - Circular Visualizer
        const bufferLength = this.dataArray.length;
        // Use lower half of spectrum (bass/mids) effectively
        const usableLength = Math.floor(bufferLength * 0.7);
        const barCount = 120; // Number of bars around the circle
        const angleStep = (Math.PI * 2) / barCount;

        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);

        // Get style accent color if available
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1db954';

        for (let i = 0; i < barCount; i++) {
            // Map bar index to frequency index
            // We want symmetry, so we go up then down
            let dataIndex;
            if (i < barCount / 2) {
                dataIndex = Math.floor(i * (usableLength / (barCount / 2)));
            } else {
                dataIndex = Math.floor((barCount - i) * (usableLength / (barCount / 2)));
            }

            const value = this.dataArray[dataIndex] || 0;

            // Dynamic bar height
            // Sensitivity adjustment
            const barHeight = Math.pow(value / 255, 2.5) * (Math.min(this.width, this.height) * 0.3);

            // Color gradient
            const percent = value / 255;

            this.ctx.save();
            this.ctx.rotate(i * angleStep);

            // Draw Bar
            if (barHeight > 2) {
                // Glow effect for high energy
                if (percent > 0.6) {
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = accentColor;
                }

                this.ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + percent * 0.8})`;

                // Round rounded rect
                this.drawRoundedRect(0, this.baseRadius, 4, barHeight, 2);
            }

            this.ctx.restore();
        }

        this.ctx.restore();
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    }
}
