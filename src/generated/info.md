# Generated source

These TypeScript files are deterministic build outputs consumed by the map runtime. Do not edit them manually.

There are no direct subfolders. Regenerate ambient layout and waterfront data through the corresponding `package.json` commands. Generated source is excluded from the authored-file line cap.

- `ambient-layout.ts` contains frozen New York trees, pedestrians, traffic, paths, and placement validation data from `data:ambient-layout`.
- `hudson-waterfront.ts` contains generated Hudson water and pier geometry metadata from `data:hudson-waterfront`.
- `info.md` is this folder guide.

- `san-diego-people-spawns.ts` contains 196 deterministic pedestrian orbits with source/layout/model hashes and campus/neighborhood counts. Regenerate using `data:san-diego:people` after building the final scene.
- `san-diego-car-spawns.ts` contains 70 road-verified ordinary-car routes and separate non-taxi policy/provenance. Regenerate using `data:san-diego:cars`; this generator is independent of NYC taxi routes and pedestrian placement.
