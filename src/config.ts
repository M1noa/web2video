import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface FlaresolverrConfig {
  enabled: boolean;
  urls: string[];
  port: number;
  maxTimeout: number;
  session: {
    enabled: boolean;
    id: string;
  };
}

export interface ProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

export interface Config {
  flaresolverr: FlaresolverrConfig;
  proxy: {
    enabled: boolean;
    servers: ProxyConfig[];
  };
  requests: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
    normalRetries: number;
    flaresolverrRetries: number;
    bypassRetries: number;
    userAgents: string[];
  };
  server: {
    port: number;
    cors: {
      enabled: boolean;
      origins: string[];
    };
  };
  video: {
    extensions: string[];
    maxFileSize: string;
    downloadTimeout: number;
  };
  bypass: {
    enabled: boolean;
    methods: string[];
    fallbackDelay: number;
    headless_browser: boolean;
  };
}

const defaultConfig: Config = {
  flaresolverr: {
    enabled: false,
    urls: ['http://localhost:8191'],
    port: 8191,
    maxTimeout: 60000,
    session: {
      enabled: true,
      id: 'web2video_session'
    }
  },
  proxy: {
    enabled: false,
    servers: []
  },
  requests: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 2000,
    normalRetries: 1,
    flaresolverrRetries: 2,
    bypassRetries: 2,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ]
  },
  server: {
    port: 3000,
    cors: {
      enabled: true,
      origins: ['*']
    }
  },
  video: {
    extensions: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v'],
    maxFileSize: '500MB',
    downloadTimeout: 300000
  },
  bypass: {
    enabled: true,
    methods: ['headers', 'useragent', 'referer', 'flaresolverr'],
    fallbackDelay: 5000,
    headless_browser: false
  }
};

export function loadConfig(): Config {
  try {
    const configPath = path.join(process.cwd(), 'config.yml');
    
    if (!fs.existsSync(configPath)) {
      console.warn('config.yml not found, using default configuration');
      return defaultConfig;
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    const loadedConfig = yaml.load(configContent) as Partial<Config>;
    
    // handle backward compatibility for flaresolverr config
    let flaresolverrConfig = { ...defaultConfig.flaresolverr };
    if (loadedConfig.flaresolverr) {
      flaresolverrConfig = { ...flaresolverrConfig, ...loadedConfig.flaresolverr };
      
      // backward compatibility: convert old 'url' to 'urls' array
      const flareConfig = loadedConfig.flaresolverr as any;
      if (flareConfig.url && !flareConfig.urls) {
        flaresolverrConfig.urls = [flareConfig.url];
        console.log('Converted legacy flaresolverr.url to urls array for backward compatibility');
      }
    }
    
    // merge with defaults to ensure all properties exist
    return {
      ...defaultConfig,
      ...loadedConfig,
      flaresolverr: flaresolverrConfig,
      proxy: {
        ...defaultConfig.proxy,
        ...loadedConfig.proxy
      },
      requests: {
        ...defaultConfig.requests,
        ...loadedConfig.requests
      },
      server: {
        ...defaultConfig.server,
        ...loadedConfig.server,
        cors: {
          ...defaultConfig.server.cors,
          ...loadedConfig.server?.cors
        }
      },
      video: {
        ...defaultConfig.video,
        ...loadedConfig.video
      },
      bypass: {
        ...defaultConfig.bypass,
        ...loadedConfig.bypass
      }
    };
  } catch (error) {
    console.error('Failed to load config.yml:', error);
    console.warn('Using default configuration');
    return defaultConfig;
  }
}