/**
 * Cloudflare Pages Function for Audio Proxy
 * Proxies audio files to bypass CORS restrictions for Web Audio API
 */

export async function onRequest(context) {
    const { request } = context;

    // Handle options
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "Range, Content-Type, Origin",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
            return new Response("Missing url parameter", { status: 400 });
        }

        // Prepare headers to forward
        const fetchHeaders = new Headers();

        // Pass Range header for seeking
        const range = request.headers.get("Range");
        if (range) {
            fetchHeaders.set("Range", range);
        }

        // Add standard headers for music streaming
        fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        fetchHeaders.set("Referer", "https://y.qq.com/");


        // Fetch the audio file
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: fetchHeaders
        });

        // Create new headers for the response
        const responseHeaders = new Headers(response.headers);

        // Set CORS headers
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type, Origin");
        responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, Accept-Ranges");

        // Ensure Content-Type is correct if missing
        if (!responseHeaders.get("Content-Type")) {
            if (targetUrl.endsWith(".mp3")) responseHeaders.set("Content-Type", "audio/mpeg");
            else if (targetUrl.endsWith(".m4a")) responseHeaders.set("Content-Type", "audio/mp4");
            else if (targetUrl.endsWith(".flac")) responseHeaders.set("Content-Type", "audio/flac");
            else if (targetUrl.endsWith(".ogg")) responseHeaders.set("Content-Type", "audio/ogg");
        }

        // Pipe the body
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}
