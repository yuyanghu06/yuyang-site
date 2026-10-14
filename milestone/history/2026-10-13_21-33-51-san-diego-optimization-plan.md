# San Diego optimization planning

Role: orchestrator recording independent planner pass.

The request was narrowed to San Diego. Planner inspected generator, loader, persistent runtime and disposal. Global background building/road/tree meshes contain 408,735 triangles and span the entire city, preventing useful close-up culling. Geometry and camera changes are outside scope.

Assignments: sd_batches owns generator and assets/provenance plus containing guides; sd_runtime owns SD loader and persistent frame integration plus containing guides. Root owns integration and milestone documents. Preserve pre-existing dirty work.

Verification: baseline full ESLint passed; direct GLB metadata confirms 439,083 triangles/7,506,908 bytes/eight meshes. Final checks require exact decoded triangles and four landmarks, unchanged source/layout/spawns, deterministic regeneration, culling measurements, targeted lint/TypeScript, live desktop/mobile navigation review, and independent evaluator. Work remains in progress.
