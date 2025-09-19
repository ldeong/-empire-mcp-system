#!/bin/bash

# 🚀 Connect Voice Agent to PWA Script
# Run after sourcing .env to test speak/build
#!/bin/bash

# 🚀 Connect Voice Agent to PWA Script
# Run after source .env to test speak/build

set -e

echo "🚀 Connecting Voice Agent to PWA..."

# 1. Source .env
source .env || { echo "❌ Failed to source .env"; exit 1; }

# 2. Start Server
npm run dev &
SERVER_PID=$!
sleep 3  # Wait for boot

# 3. Test Voice Endpoint (Speak "revenue")
echo "🧪 Testing voice endpoint..."
curl -X POST http://localhost:3000/mcp/voice \
  -H "Content-Type: application/json" \
  -d '{"command": "revenue", "sessionId": "test_speak_$(date +%s)"}' | jq .

# 4. Build PWA Assets (Manifest, Service Worker)
mkdir -p public/sina
cat > public/sina/pwa-manifest.json << 'MANIFEST'
{
  "name": "SINA Empire Voice",
  "short_name": "SINA Voice",
  "start_url": "/sina/interface",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#ff6b6b",
  "icons": [
    { "src": "/sina/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/sina/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
MANIFEST

cat > public/sina/service-worker.js << 'SW'
self.addEventListener('install', event => {
  event.waitUntil(caches.open('sina-cache').then(cache => {
    return cache.addAll(['/sina/interface', '/sina/pwa-manifest.json']);
  }));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
SW

echo "✅ PWA assets built (manifest and service worker)"

# 5. Test ElevenLabs TTS (Speak "Voice connected!")
echo "🧪 Testing ElevenLabs TTS..."
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM \
  -H "xi-api-key: $ELEVEN_LABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Voice agent connected - SINA Empire is live!"}' \
  -o /tmp/voice_test.mp3

aplay /tmp/voice_test.mp3 2>/dev/null || echo "⚠️ TTS saved to /tmp/voice_test.mp3 - play manually"

# 6. Open PWA in Browser (Speak Test)
echo "🌐 Opening PWA for manual speak test..."
xdg-open http://localhost:8787/sina/interface 2>/dev/null || echo "⚠️ Open http://localhost:8787/sina/interface in browser"

# 7. Kill Server (Clean Up)
sleep 10  # Give time to test
kill $SERVER_PID 2>/dev/null || true

echo "✅ Voice connection test complete!"
echo "Manual test: Run 'npm run dev', open http://localhost:8787/sina/interface, click 'Start Voice', say 'revenue'."
echo "Auth: Run 'gh auth login' and 'wrangler login' if needed."
