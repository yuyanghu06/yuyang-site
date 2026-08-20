# Ambient pedestrians and traffic

- Added 300 deterministic low-detail pedestrians distributed across the full Washington Square data radius while rejecting official roadbeds and CityGML building footprints.
- Pedestrians use two instanced meshes, varied clothing, small walking circuits, directional rotation, and subtle bobbing for low-overhead ambient life.
- Added 72 instanced low-detail cars whose routes and headings derive from the dominant axes of official planimetric road polygons.
- Exactly every third car is yellow to read as a taxi; remaining traffic uses restrained blue-gray and warm off-white.
- Both ambient systems animate continuously and keep placements stable between reloads.
- `npm run lint` and `npm run build` both pass.
