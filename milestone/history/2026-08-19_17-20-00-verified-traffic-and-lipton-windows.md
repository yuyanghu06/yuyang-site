# Verified traffic and Lipton windows

- Increased ambient traffic from 72 to 100 cars.
- Replaced permissive PCA routes with validated routes built only from elongated official road polygons. Each route is repeatedly sampled across its width and accepted only when it remains inside the polygon, outside road holes, and clear of building footprints.
- Corrected car yaw so each model's long axis points along its actual movement vector rather than sliding sideways.
- Changed pedestrian placement to validate each complete walking loop, including clearance probes against roads and building footprints, preventing animation paths from entering buildings.
- Substantially lightened One Fifth Avenue, Silver Center, and Lipton Hall.
- Added 447 instanced windows stacked by floor across 14 eligible Lipton Hall facade faces, with outward-facing offsets derived from the building center.
- `npm run lint` and `npm run build` both pass.
