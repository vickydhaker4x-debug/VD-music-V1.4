import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { streamRouter } from './server/streamRouter.ts';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// JSON and URL-encoded body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Audio streaming CORS & Range headers support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, X-Requested-With, Cache-Control');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, X-Next-Track-Id, X-Prebuffer-Chunk-Url, X-Prebuffer-Duration');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VD Music Ultra-Fast Audio Core',
    version: '2.0.0',
    capabilities: [
      'Zero-Latency Playback',
      'HLS & MPEG-DASH Manifest Engine',
      'Intelligent Byte-Range Chunking',
      'Lookahead 10s Pre-buffer & Caching',
      'Adaptive Bitrate (ABR) Optimization'
    ],
    timestamp: Date.now()
  });
});

// Mount Module 1: Ultra-Fast Streaming & Audio Delivery API routes
app.use('/api/stream', streamRouter);

// Start Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VD Music] Core Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
