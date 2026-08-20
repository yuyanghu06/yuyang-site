# Geometry-first loading motion

- Removed the blocking centered text loader; the WebGL canvas now appears immediately.
- Made the expanded official roadbed mesh the first visible loading stage, fading and spring-sliding into its final elevation.
- Strengthened building arrival into a damped below-ground rise with visible overshoot.
- Coordinated every building batched inside a tile to pop simultaneously, while tiles stagger radially outward from the active camera center.
- Retained tiles replay their coordinated spring on square traversal; tiles farther than 700 m from the settled destination are disposed and must re-enter on return.
- Replaced the labeled navigation pill with a translucent white circular up/down arrow while preserving accessible destination text.
