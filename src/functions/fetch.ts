import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import * as path from 'path';
import { loadConfig, Config } from '../config';

let config: Config;

// load configuration
function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}

// get random user agent from config
function getRandomUserAgent(): string {
  const cfg = getConfig();
  const userAgents = cfg.requests.userAgents;
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// enhanced headers for bypassing blocks
function getEnhancedHeaders(url?: string): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };
  
  // add referer for specific sites
  if (url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        baseHeaders['Referer'] = 'https://www.youtube.com/';
      } else if (hostname.includes('vimeo.com')) {
        baseHeaders['Referer'] = 'https://vimeo.com/';
      } else if (hostname.includes('dailymotion.com')) {
        baseHeaders['Referer'] = 'https://www.dailymotion.com/';
      } else {
        baseHeaders['Referer'] = 'https://www.google.com/';
      }
    } catch (e) {
      baseHeaders['Referer'] = 'https://www.google.com/';
    }
  }
  
  return baseHeaders;
}

// rate limiting delay
function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// make request through flaresolverr
async function fetchWithFlareSolverr(
  url: string,
  flaresolverrUrl: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  const cfg = getConfig();
  const flareConfig = cfg.flaresolverr;
  
  const requestData = {
    cmd: 'request.get',
    url: url,
    maxTimeout: flareConfig.maxTimeout,
    ...(flareConfig.session.enabled && flareConfig.session.id && {
      session: flareConfig.session.id
    }),
    ...(options.headers && { headers: options.headers })
  };

  try {
    const response = await axios.post(flaresolverrUrl + '/v1', requestData, {
      timeout: flareConfig.maxTimeout + 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.status === 'ok') {
      return {
        ...response,
        data: response.data.solution.response,
        status: response.data.solution.status,
        headers: response.data.solution.headers
      };
    } else {
      throw new Error(`FlareSolverr error: ${response.data.message}`);
    }
  } catch (error: any) {
    throw new Error(`FlareSolverr request failed: ${error.message}`);
  }
}

// make request through headless browser
async function fetchWithHeadlessBrowser(url: string): Promise<string> {
  // placeholder for headless browser implementation
  // this would typically use puppeteer or playwright
  throw new Error('Headless browser bypass not implemented yet');
}

// main fetch function with bypass capabilities
export async function fetchWithBypass(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  const cfg = getConfig();
  const errors: string[] = [];

  // prepare request options
  const requestOptions: AxiosRequestConfig = {
    ...options,
    headers: {
      ...getEnhancedHeaders(url),
      ...options.headers
    },
    timeout: options.timeout || cfg.requests.timeout,
    maxRedirects: 5,
    validateStatus: (status) => status < 500 // don't throw on 4xx errors
  };

  // Step 1: Try normal request with configurable retries
  for (let attempt = 1; attempt <= cfg.requests.normalRetries; attempt++) {
    try {
      console.log(`Normal fetch attempt ${attempt}/${cfg.requests.normalRetries}: ${url}`);
      
      const response = await axios(url, requestOptions);
      
      // check if we got blocked (common blocking status codes)
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        throw new Error(`Request blocked with status ${response.status}`);
      }
      
      return response;
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      errors.push(`normal_attempt_${attempt}: ${errorMsg}`);
      console.warn(`Normal fetch attempt ${attempt} failed:`, errorMsg);
      
      if (attempt < cfg.requests.normalRetries) {
        await randomDelay(cfg.requests.retryDelay, cfg.requests.retryDelay * 2);
        // rotate user agent for next attempt
        requestOptions.headers = {
          ...getEnhancedHeaders(url),
          ...options.headers
        };
      }
    }
  }

  // Step 2: Try FlareSolverr with configurable retries if enabled
  if (cfg.flaresolverr.enabled && cfg.flaresolverr.urls.length > 0) {
    for (let urlIndex = 0; urlIndex < cfg.flaresolverr.urls.length; urlIndex++) {
      const flaresolverrUrl = cfg.flaresolverr.urls[urlIndex];
      
      for (let attempt = 1; attempt <= cfg.requests.flaresolverrRetries; attempt++) {
        try {
          console.log(`FlareSolverr URL ${urlIndex + 1}/${cfg.flaresolverr.urls.length} attempt ${attempt}/${cfg.requests.flaresolverrRetries} (${flaresolverrUrl})...`);
          await randomDelay(cfg.bypass.fallbackDelay);
          return await fetchWithFlareSolverr(url, flaresolverrUrl, requestOptions);
        } catch (error: any) {
          const errorMsg = error.message || String(error);
          errors.push(`flaresolverr_${urlIndex + 1}_${attempt}: ${errorMsg}`);
          console.warn(`FlareSolverr URL ${urlIndex + 1} attempt ${attempt} failed:`, errorMsg);
          
          if (attempt < cfg.requests.flaresolverrRetries) {
            await randomDelay(cfg.requests.retryDelay);
          }
        }
      }
      
      // Add delay before trying next FlareSolverr URL
      if (urlIndex < cfg.flaresolverr.urls.length - 1) {
        console.log(`Trying next FlareSolverr URL...`);
        await randomDelay(cfg.requests.retryDelay);
      }
    }
  }

  // Step 3: Try additional bypass methods with configurable retries if enabled
  if (cfg.bypass.enabled && cfg.bypass.methods) {
    for (const method of cfg.bypass.methods) {
      // Skip flaresolverr as we already tried it
      if (method === 'flaresolverr') continue;
      
      for (let attempt = 1; attempt <= cfg.requests.bypassRetries; attempt++) {
        try {
          console.log(`Bypass method ${method} attempt ${attempt}/${cfg.requests.bypassRetries}...`);
          
          // For now, we'll use the same enhanced headers approach
          // but with different user agents and delays
          await randomDelay(cfg.bypass.fallbackDelay);
          
          // Rotate user agent and headers for each method
          const methodRequestOptions = {
            ...requestOptions,
            headers: {
              ...getEnhancedHeaders(url),
              ...options.headers
            }
          };
          
          const response = await axios(url, methodRequestOptions);
          
          if (response.status < 400) {
            console.log(`Bypass method ${method} succeeded`);
            return response;
          }
          
          throw new Error(`Method ${method} returned status ${response.status}`);
        } catch (error: any) {
          const errorMsg = error.message || String(error);
          errors.push(`${method}_${attempt}: ${errorMsg}`);
          console.warn(`Bypass method ${method} attempt ${attempt} failed:`, errorMsg);
          
          if (attempt < cfg.requests.bypassRetries) {
            await randomDelay(cfg.requests.retryDelay);
          }
        }
      }
    }
  }

  // if all attempts failed, throw error with all failure details
  throw new Error(`All fetch methods failed: ${errors.join(', ')}`);
}

// video extraction interface
export interface VideoInfo {
  url: string;
  type: 'video-tag' | 'source-tag' | 'link' | 'regex-match' | 'iframe' | 'video-data-attr';
  poster?: string;
  text?: string;
  title?: string;
  duration?: string;
  quality?: string;
  fileSize?: number;
  resolution?: string;
  format?: string;
}

// resolve relative urls
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return url;
  }
}

// extract videos from html content
export function extractVideos(
  html: string,
  baseUrl: string,
  videoExtensions?: string[]
): VideoInfo[] {
  const cfg = getConfig();
  const extensions = videoExtensions || cfg.video.extensions;
  const $ = cheerio.load(html);
  const videos: VideoInfo[] = [];
  
  // image extensions to filter out
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
  
  // helper function to check if url is an image
  const isImageFile = (url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  // find video tags with enhanced support
  try {
    $('video').each((i, elem) => {
      const $video = $(elem);
      let mainSrc = $video.attr('src');
      
      // if video has direct src attribute
       if (mainSrc && !isImageFile(mainSrc)) {
         try {
           const posterAttr = $video.attr('poster');
           videos.push({
             url: resolveUrl(mainSrc, baseUrl),
             type: 'video-tag',
             poster: posterAttr ? resolveUrl(posterAttr, baseUrl) : undefined,
             title: $video.attr('title') || $video.attr('alt') || $video.attr('data-title'),
             duration: $video.attr('duration')
           });
        } catch (urlError: any) {
          console.warn(`failed to resolve video url: ${mainSrc}`, urlError.message);
        }
      }

      // check all source tags within video (including when video has src)
      $video.find('source').each((j, sourceElem) => {
        const $source = $(sourceElem);
        const sourceSrc = $source.attr('src');
        
        if (sourceSrc && !isImageFile(sourceSrc)) {
          try {
            const resolvedUrl = resolveUrl(sourceSrc, baseUrl);
            // avoid duplicates
            if (!videos.some(v => v.url === resolvedUrl)) {
              videos.push({
                url: resolvedUrl,
                type: 'source-tag',
                quality: $source.attr('label') || $source.attr('data-quality') || $source.attr('size'),
                format: $source.attr('type')?.split('/')[1],
                title: $video.attr('title') || $video.attr('alt') || $video.attr('data-title')
              });
            }
          } catch (urlError: any) {
            console.warn(`failed to resolve source url: ${sourceSrc}`, urlError.message);
          }
        }
      });
      
      // if no src found in video or source tags, try data attributes
      if (!mainSrc && $video.find('source').length === 0) {
        const dataSrc = $video.attr('data-src') || $video.attr('data-video-src');
        if (dataSrc && !isImageFile(dataSrc)) {
          try {
            videos.push({
              url: resolveUrl(dataSrc, baseUrl),
              type: 'video-data-attr',
              title: $video.attr('title') || $video.attr('alt') || $video.attr('data-title')
            });
          } catch (urlError: any) {
            console.warn(`failed to resolve data-src url: ${dataSrc}`, urlError.message);
          }
        }
      }
    });
  } catch (videoParseError: any) {
    console.warn('error parsing video tags:', videoParseError.message);
  }

  // find links to video files (exclude favicons and images)
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && extensions.some(ext => href.toLowerCase().includes(ext))) {
      // exclude favicon urls and image files
      if (href.toLowerCase().includes('favicon') || href.toLowerCase().includes('favi') || isImageFile(href)) {
        return;
      }
      videos.push({
        url: resolveUrl(href, baseUrl),
        type: 'link',
        text: $(elem).text().trim(),
        title: $(elem).attr('title')
      });
    }
  });

  // find video urls in script tags and page content with proper error handling
  try {
    const escapedExtensions = extensions.map(ext => {
      const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
      return cleanExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    
    if (escapedExtensions.length > 0) {
      const videoUrlPattern = new RegExp(
        `https?:\/\/[^\s"'<>]+\.(?:${escapedExtensions.join('|')})(?:\\?[^\s"'<>]*)?`,
        'gi'
      );
      
      const matches = html.match(videoUrlPattern) || [];
      
      matches.forEach(match => {
        // exclude favicon urls and image files from regex matches
        if (match.toLowerCase().includes('favicon') || match.toLowerCase().includes('favi') || isImageFile(match)) {
          return;
        }
        if (!videos.some(v => v.url === match)) {
          videos.push({
            url: match,
            type: 'regex-match'
          });
        }
      });
    }
  } catch (regexError: any) {
    console.warn('regex pattern error:', regexError.message);
  }

  // check for embedded videos in iframes
  $('iframe[src]').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src) {
      const resolvedSrc = resolveUrl(src, baseUrl);
      // check if iframe contains video platforms
      if (
        resolvedSrc.includes('youtube.com') ||
        resolvedSrc.includes('youtu.be') ||
        resolvedSrc.includes('vimeo.com') ||
        resolvedSrc.includes('dailymotion.com') ||
        resolvedSrc.includes('twitch.tv') ||
        resolvedSrc.includes('streamable.com')
      ) {
        videos.push({
          url: resolvedSrc,
          type: 'iframe',
          title: $(elem).attr('title')
        });
      }
    }
  });

  // remove duplicates
  const uniqueVideos = videos.filter((video, index, self) => 
    index === self.findIndex(v => v.url === video.url)
  );

  return uniqueVideos;
}

// get video metadata without downloading
export async function getVideoMetadata(url: string): Promise<Partial<VideoInfo>> {
  try {
    const response = await fetchWithBypass(url, {
      method: 'HEAD',
      timeout: 10000
    });

    const metadata: Partial<VideoInfo> = {
      url,
      fileSize: response.headers['content-length'] ? parseInt(response.headers['content-length']) : undefined,
      format: response.headers['content-type']?.split('/')[1] || path.extname(new URL(url).pathname).slice(1)
    };

    // try to get additional metadata with a partial content request
    try {
      const partialResponse = await fetchWithBypass(url, {
        headers: {
          'Range': 'bytes=0-1024'
        },
        timeout: 5000
      });
      
      // basic video format detection
      if (partialResponse.data) {
        const buffer = Buffer.from(partialResponse.data);
        
        // detect mp4
        if (buffer.includes(Buffer.from('ftyp'))) {
          metadata.format = 'mp4';
        }
        // detect webm
        else if (buffer.includes(Buffer.from('webm'))) {
          metadata.format = 'webm';
        }
        // detect avi
        else if (buffer.includes(Buffer.from('AVI '))) {
          metadata.format = 'avi';
        }
      }
    } catch (e) {
      // ignore partial content errors
    }

    return metadata;
  } catch (error: any) {
    console.warn(`Failed to get metadata for ${url}:`, error.message);
    return { url };
  }
}

// export config reload function
export function reloadConfig(): void {
  config = loadConfig();
}