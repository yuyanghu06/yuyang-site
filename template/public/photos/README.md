# Background Image

Place your background image here as `BACKGROUND.jpeg`.

This image is used as the full-screen background across the entire site:
- **Home page**: displayed at full resolution, no blur
- **Interior pages** (About, Projects, Contact): displayed with `blur(18px)` + `scale(1.05)`

## Requirements

- **Filename**: Must be exactly `BACKGROUND.jpeg`
- **Format**: JPEG recommended for best performance
- **Resolution**: At least 1920×1080; 2560×1440 or higher recommended for retina displays
- **Aspect ratio**: Landscape works best (the image is `object-fit: cover`)
- **Content**: Choose something visually striking — it sets the entire mood of the site

## How it's referenced

The image is served at `/public/photos/BACKGROUND.jpeg` and referenced via:
- CSS variable `--bg-image` in `client/src/styles/global.css`
- `CONFIG.backgroundImage` in `client/src/config.ts`

**Do not move or rename this file.** The site won't load correctly without it.
