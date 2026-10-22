# Neighborhood views

Washington Square, Union Square, landmark, park, path, fountain, and custom-building helpers live here.

Interactive landmark details must be merged with the base geometry before outlines, raycasting, hover, lift, click, or camera interactions.

There are no direct subfolders.

- `info.md` is this folder guide.
- `landmarks.ts` builds interactive buildings, facade/roof details, Stern's rotunda, Gould Plaza and the Courant garden, and bakes landmark geometry into a single selectable mesh.
- `park.ts` builds park surfaces, trees, paths, crosswalks, fountains and the fallback arch; loads the arch and Bobst through shared GLB helpers, which it also re-exports for compatibility. The shared material replacement releases superseded materials/textures that no retained drawable still uses. The arch keeps its established white material and authored fitting.
