# Warm map visual pass

- Replaced uniform white CityGML massing with deterministic per-building cream, sandstone, muted brick, and sage colors; roofs receive a lighter variant.
- Added warm haze, soft golden lighting, ACES tone mapping, and softer shadows based on the illustrated reference.
- Tightened the orthographic framing by 30%, lowered the camera elevation by 30%, and added horizontal pointer-drag rotation while leaving pan and user zoom disabled.
- Darkened official NYC planimetric roadbeds to muted charcoal-gray.
- Updated the on-screen camera hint from fixed camera to drag-to-rotate.
- ESLint and the optimized Next.js build passed before the final constant-only camera-height and road-color adjustments.
