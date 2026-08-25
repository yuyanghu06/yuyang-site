# Project TODO

- After the Washington Square data pipeline is stable, delete obsolete source files, generated assets, prototype data, and unused dependencies to reduce repository and local disk usage.
- Keep complete upstream downloads and temporary conversion files in the gitignored `data/raw/` and `data/work/` directories.
- Keep only the cropped, runtime-ready Washington Square geometry and address data used by the website in tracked project directories such as `public/data/`.
- Add an indexable personal blog designed to strengthen SEO for Yuyang's name, including article routes, author identity/schema metadata, canonical URLs, social previews, sitemap/RSS support, and a sustainable publishing workflow.
- Replace the conventional initial render/mount loading screen with a small animated avatar of Yuyang connected to his AI. The avatar/AI should talk to the visitor while the persistent renderer and first complete scene prepare, turning startup wait time into an intentional conversational introduction while still preventing incomplete scene geometry from showing through.
- Add a layered background-audio system with music and view-aware ambience: bird and airplane sounds during the Manhattan overview, subtle people-talking/crowd ambience in zoomed-in neighborhood and landmark views, and stylized satellite/space sounds during the Earth view. Crossfade layers between camera states, keep dialogue intelligible, provide independent music/effects volume controls and mute, and respect browser autoplay and reduced-motion/accessibility preferences.
