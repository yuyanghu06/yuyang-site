# SVG marker visibility fallback

- Added explicit intrinsic dimensions to both point-of-interest SVG assets.
- Added an immediate vector-equivalent fallback texture that is replaced when each SVG finishes decoding, preventing blank markers during initial load or hot reload.
