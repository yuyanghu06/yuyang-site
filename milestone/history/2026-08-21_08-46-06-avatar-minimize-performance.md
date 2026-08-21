# Avatar minimize performance

The supplied 6.57-second screen recording showed the fullscreen avatar shell stalling while it collapsed into the dock. The resize was animating a large overflow-clipped modal around both a continuously rendered WebGL canvas and Chromium's live SVG backdrop refraction.

`AvatarCall` now marks the 460 ms minimize/restore interval as transitional. During that interval it unmounts `simple-liquid-glass` and uses a lightweight matching translucent surface, then restores live refraction after the geometry has settled. The persistent avatar renderer, shared camera, animation state, expanded framing, and tuned dock crop remain unchanged.

Targeted verification passed with `npx eslint src/components/avatar-call.tsx` and `npx tsc --noEmit --pretty false`. No full production build was run because this was an iterative UI performance fix.
