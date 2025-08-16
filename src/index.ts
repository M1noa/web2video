import express, { Request, Response } from 'express';
import path from 'path';
import { URL } from 'url';
import { loadConfig, Config } from './config';
import { fetchWithBypass, extractVideos, getVideoMetadata, VideoInfo } from './functions/fetch';

const app = express();
let config: Config;

// load configuration
try {
  config = loadConfig();
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

const PORT = process.env.PORT || config.server.port || 3000;

app.use(express.json());
app.use(express.static('public'));

// cors middleware if enabled
if (config.server.cors.enabled) {
  app.use((req, res, next) => {
    const origins = config.server.cors.origins;
    const origin = req.headers.origin;
    
    if (origins.includes('*') || (origin && origins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

// resolve relative urls
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return url;
  }
}

// api endpoint to fetch and parse videos
app.post('/api/fetch-videos', async (req: Request, res: Response) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // handle relative paths
    if (url.startsWith('/')) {
      return res.status(400).json({ error: 'Please provide a full URL with domain' });
    } else if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    console.log(`Fetching: ${url}`);

    // use enhanced fetch with bypass capabilities
    const response = await fetchWithBypass(url, {
      timeout: config.requests.timeout,
      maxRedirects: 5
    });

    const videos = extractVideos(response.data, url, config.video.extensions);
    
    return res.json({
      success: true,
      url: url,
      videos: videos,
      count: videos.length
    });

  } catch (error: any) {
    console.error('Error fetching videos:', error.message);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch videos' 
    });
  }
});

// get video metadata endpoint
app.get('/api/video-metadata', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const metadata = await getVideoMetadata(url);
    
    return res.json({
      success: true,
      metadata
    });

  } catch (error: any) {
    console.error('Metadata error:', error.message);
    return res.status(500).json({ error: 'Failed to get video metadata' });
  }
});

// health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      flaresolverr: config.flaresolverr.enabled,
      proxy: config.proxy.enabled,
      bypass: config.bypass.enabled
    }
  });
});

// serve the main html file
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web2Video server running on http://localhost:${PORT}`);
  console.log(`Flaresolverr: ${config.flaresolverr.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Proxy: ${config.proxy.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Bypass methods: ${config.bypass.enabled ? 'Enabled' : 'Disabled'}`);
});

// export for deployment platforms
export default app;