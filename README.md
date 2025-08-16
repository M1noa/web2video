# Web2Video
> [!WARNING]
> This is not a Cobalt competitor.
> 
> This is a simple video downloader that extracts videos from `<video>` tags on websites. It is not a YouTube downloader or similar service - it's designed specifically for downloading embedded videos from basic websites, particularly useful for mobile users.

A TypeScript-based video downloader that extracts videos from web pages with advanced bypass capabilities.

## Features

- **TypeScript Support**: Full TypeScript implementation with type safety
- **Bypass Capabilities**: Multiple methods to bypass anti-bot protection
- **Flaresolverr Integration**: Optional Cloudflare bypass using Flaresolverr
- **Proxy Support**: Configurable proxy rotation
- **Video Extraction**: Intelligent video detection from various sources
- **YAML Configuration**: Easy-to-edit configuration file

## Installation

```bash
npm install
```

## Configuration

Edit `config.yml` to customize the application:

### Flaresolverr Setup

```yaml
flaresolverr:
  enabled: true
  url: "http://localhost:8191"
  port: 8191
  maxTimeout: 60000
  session:
    enabled: true
    id: "web2video_session"
```

### Proxy Configuration

```yaml
proxy:
  enabled: true
  servers:
    - host: "proxy.example.com"
      port: 8080
      auth:
        username: "user"
        password: "pass"
```

### Bypass Methods

```yaml
bypass:
  enabled: true
  methods:
    - "headers"
    - "useragent"
    - "referer"
    - "flaresolverr"
  fallbackDelay: 5000
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Watch Mode

```bash
npm run watch
```

## API Endpoints

### POST /api/fetch-videos

Extracts video URLs from a given webpage with metadata.

**Request Body:**
```json
{
  "url": "https://example.com/page-with-videos"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com/page-with-videos",
  "videos": [
    {
      "url": "https://example.com/video.mp4",
      "type": "video-tag",
      "title": "Sample Video",
      "fileSize": 15728640,
      "format": "mp4",
      "resolution": "1920x1080"
    }
  ],
  "count": 1
}
```

### GET /api/video-metadata

Returns metadata for a specific video URL without downloading.

**Query Parameters:**
- `url`: The video URL to analyze

**Response:**
```json
{
  "success": true,
  "metadata": {
    "url": "https://example.com/video.mp4",
    "fileSize": 15728640,
    "format": "mp4"
  }
}
```

### GET /api/health

Returns server health status and configuration.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "config": {
    "flaresolverr": false,
    "proxy": false,
    "bypass": true
  }
}
```

## Bypass Methods

1. **Headers**: Enhanced HTTP headers with realistic browser signatures
2. **User-Agent**: Rotating user agents from real browsers
3. **Referer**: Smart referer injection based on target site
4. **Flaresolverr**: Cloudflare bypass using browser automation

## Video Detection

The application detects videos from:

- `<video>` tags and their `<source>` children
- Direct links to video files
- Embedded videos in iframes
- Video URLs in JavaScript and page content
- Popular video platforms (YouTube, Vimeo, etc.)

## Supported Video Formats

- MP4
- WebM
- OGG
- AVI
- MOV
- WMV
- FLV
- MKV
- M4V

## Author

**Minoa**
- GitHub: [@M1noa](https://github.com/M1noa)
- Website: [https://minoa.cat](https://minoa.cat)

## License

MIT License
