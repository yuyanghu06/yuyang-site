# Application source

The application source includes the Next.js route shell, server-side agent orchestration, reusable browser components, and deterministic generated map data. Authored source must remain below the ESLint line cap.

## Direct subfolders

- `agent/` owns agent contracts, mandatory Pinecone retrieval, and the OpenAI Responses tool loop.
- `app/` owns App Router pages, metadata, and API routes.
- `components/` owns reusable UI and the persistent Three.js experience.
- `generated/` contains deterministic generated map source.
- `styles/` centralizes the global base layer and feature-owned stylesheets imported by their corresponding routes or components.

## Direct files

- `info.md` documents this folder.
