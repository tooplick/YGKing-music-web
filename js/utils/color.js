/**
 * Color Extraction Utility
 * Extracts dominant color from an image URL using canvas sampling.
 */

/**
 * Extract dominant color from an image URL
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<{r: number, g: number, b: number, hex: string}>}
 */
export async function extractDominantColor(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        // Use wsrv.nl as CORS-friendly image proxy
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=jpg`;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Use a small size for performance
                const size = 50;
                canvas.width = size;
                canvas.height = size;

                ctx.drawImage(img, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size).data;

                let r = 0, g = 0, b = 0;
                let count = 0;

                // Sample every 4th pixel for speed
                for (let i = 0; i < imageData.length; i += 16) {
                    const pr = imageData[i];
                    const pg = imageData[i + 1];
                    const pb = imageData[i + 2];
                    const pa = imageData[i + 3];

                    // Skip transparent pixels
                    if (pa < 128) continue;

                    // Skip very dark or very light pixels for more vibrant results
                    const brightness = (pr + pg + pb) / 3;
                    if (brightness < 30 || brightness > 225) continue;

                    r += pr;
                    g += pg;
                    b += pb;
                    count++;
                }

                if (count === 0) {
                    // Fallback to default accent color
                    resolve({ r: 29, g: 185, b: 84, hex: '#1db954', isFallback: true });
                    return;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // Boost saturation slightly for more vibrant color
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const mid = (max + min) / 2;

                const boost = 1.2;
                r = Math.max(0, Math.min(255, Math.round(mid + (r - mid) * boost)));
                g = Math.max(0, Math.min(255, Math.round(mid + (g - mid) * boost)));
                b = Math.max(0, Math.min(255, Math.round(mid + (b - mid) * boost)));

                const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

                resolve({ r, g, b, hex, isFallback: false });
            } catch (e) {
                console.warn('Color extraction failed:', e);
                resolve({ r: 29, g: 185, b: 84, hex: '#1db954', isFallback: true });
            }
        };

        img.onerror = () => {
            console.warn('Failed to load image for color extraction');
            resolve({ r: 29, g: 185, b: 84, hex: '#1db954', isFallback: true });
        };

        img.src = proxyUrl;
    });
}

export default { extractDominantColor };
