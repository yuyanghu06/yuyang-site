# Application styles

This folder centralizes the site's CSS. The root layout loads the small global base layer, while routes and components load feature-specific stylesheets. The shared liquid-glass surface primitive lives only in the global base and is applied by class to assistant bubbles, audio controls, and social controls.

## Direct subfolders

This folder has no direct subfolders.

## Direct files

- `INFO.md` documents this folder.
- `globals.css` defines design tokens, resets, document defaults, and the shared `liquid-glass-surface` and `liquid-glass-control` primitives.
- `social-links.css` styles the home page's responsive social-profile controls and gates their 220 ms fade-in until the avatar's 460 ms minimization transition has fully settled.
- `map-shell.css` styles the persistent map viewport, canvas, cloud transition, switcher, loading state, and credit.
- `world-loader.css` styles the white production entry loader, including a 30%-enlarged composition, ping-pong continent drift, centered three-line build log, matched 2.5-rem title/log and title/CTA gaps, dark `Dive in!` CTA, and whole-screen exit fade.
- `avatar-call.css` styles the expanded and docked avatar shell, avatar canvas placement, controls, transitions, and responsive geometry. Desktop docked audio controls exactly match the social controls' 2.65-rem circles and use a fixed square flex basis plus a one-to-one aspect ratio so they cannot become ovals. Short-landscape expanded framing consumes the dialogue renderer's live `--expanded-avatar-top` measurement, clamped between 32% and 48%, so the portrait follows changing wrapped text and controls without changing portrait-mobile or desktop placement.
- `agent-chat.css` styles dialogue history, intrinsically sized assistant captions, visitor messages, actions, composer controls, docked placement, and responsive chat behavior without duplicating the shared liquid-glass surface declarations. Visitor and assistant message text share the same responsive font size. The pending Thinking and Remembering labels use a reduced-motion-aware character wave. Assistant cards clip their shared glass layer to the inherited rounded boundary and replace its broad outer shadow with an inset highlight, preventing rectangular shadow plates. Its docked mobile and short-landscape override resets the generic 45% chat height to intrinsic sizing, reserves a 1.25-rem viewport-edge inset in the caption width calculation, and renders choice pills at 75% of their desktop dimensions.
