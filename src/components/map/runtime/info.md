# Map runtime

`map-runtime.tsx` composes scene setup, navigation, interaction, lifecycle, and extracted frame systems behind the thin `../map.tsx` entry. Manhattan data, tile, park, landmark, route, and ambient loading is owned by `../manhattan/loading/`; resource disposal is owned by `dispose-runtime.ts`.

Continue reducing this orchestration layer by moving cohesive controllers out with typed inputs. It must retain one persistent renderer and must not remount between geographic views.
