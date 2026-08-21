# Map runtime

`map-runtime.tsx` composes scene setup, navigation, input, and extracted systems behind the thin `../map.tsx` entry. Manhattan loading is owned by `../manhattan/loading/`, hit-testing by `../interaction/`, viewport suspension/start-stop by `viewport-lifecycle.ts`, and resource disposal by `dispose-runtime.ts`.

Continue reducing this orchestration layer by moving cohesive controllers out with typed inputs. It must retain one persistent renderer and must not remount between geographic views.
