# Map runtime

`map-runtime.tsx` composes scene setup, navigation, input, and extracted systems behind the thin `../map.tsx` entry. Its globe view applies a restrained idle spin and parents clouds, planes, boats, and the NYC marker to the same interactive globe transform. Manhattan loading is owned by `../manhattan/loading/`, hit-testing by `../interaction/`, viewport suspension/start-stop by `viewport-lifecycle.ts`, and resource disposal by `dispose-runtime.ts`.

## Files

- `dispose-runtime.ts` disposes renderer and scene resources when the map unmounts.
- `info.md` is this local ownership guide.
- `map-runtime.tsx` imports the reorganized agent contracts and JSON-backed camera context, owns the persistent client-side renderer, geographic and landmark view orchestration, validated agent-navigation event handling, settled-view browser notifications, audio-state reporting to the shared site controller, and forwarding of the shell's experience-started gate into the avatar call. It resolves every interactive landmark and its framing from the shared live camera-view registry; agent navigation always uses authored interpolation or the globe cloud flight, and cross-level destinations queue and fully settle at every intermediate camera before advancing instead of cutting camera modes. Its bottom-right attribution line also exposes the unobtrusive internal link to the crawlable blog.
- `viewport-lifecycle.ts` suspends and resumes animation based on page visibility and viewport presence.

Continue reducing this orchestration layer by moving cohesive controllers out with typed inputs. It must retain one persistent renderer and must not remount between geographic views.
