# Build and authoring scripts

Repeatable asset and data transformations are grouped by domain. Keep outputs deterministic where practical and document any new command in `package.json`.

Scripts are authored code and are covered by the repository line-count rule.

## Direct subfolders

- `avatar/` contains repeatable avatar conversion, validation, and export scripts.
- `blender/` contains Blender automation used for repository 3D assets.
- `loaders/` contains build-time source loaders, including the Markdown-to-string loader used by camera dialogue.
- `map-data/` contains source-to-runtime map dataset and geometry builders.
- `memory/` contains the deterministic canonical-memory chunk builder and explicitly confirmed Pinecone replacement-ingestion command.
- `previews/` contains scripts for generating isolated visual review artifacts.

## Direct files

- `info.md` is the authoritative guide to this scripts folder.
