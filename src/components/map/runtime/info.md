# Map runtime

`map-runtime.tsx` composes scene setup, navigation, input, and extracted systems behind the thin `../map.tsx` entry. Its globe view applies a restrained idle spin and parents clouds, planes, boats, and both city markers to the same interactive globe transform. Manhattan loading is owned by `../manhattan/loading/`, hit-testing by `../interaction/`, viewport suspension/start-stop by `viewport-lifecycle.ts`, and resource disposal by `dispose-runtime.ts`.

## Files

- `dispose-runtime.ts` disposes shared geometry, material, and texture resources when the map unmounts; its object-only cleanup also handles lazy results that finish after teardown.
- `info.md` is this local ownership guide.
- `landmark-framing.ts` projects all eight merged landmark bounds corners through the destination camera to cap San Diego landmark zoom with a 7% viewport-edge inset. The runtime recalculates this fit on selection and on resize while locked and not manually adjusted; New York presets and the screenshot-centered San Diego overview stay unchanged.
- `san-diego-free-camera.ts` retains the disabled San Diego authoring flag, orthographic orbit/tilt/pan/zoom math, elevation and zoom limits, and displayed-pose JSON serialization. Its flag is false: San Diego uses fixed authored framing and guided inputs, with no authoring controls shown. It has no persistent storage or authored-preset writes.
- `map-runtime.tsx` imports the reorganized agent contracts and JSON-backed camera context, owns the persistent client-side renderer, geographic and landmark view orchestration, validated agent-navigation event handling, settled-view browser notifications, audio-state reporting to the shared site controller, and forwarding of the shell's experience-started gate into the avatar call. It resolves every interactive landmark and its framing from the shared live camera-view registry; agent navigation always uses authored interpolation or the globe cloud flight, and cross-level destinations queue and fully settle at every intermediate camera before advancing instead of cutting camera modes. San Diego is dynamically imported and decoded only on first entry, rendered in a separate scene with matching warm light, and held behind the cloud veil until its merged landmark roots are ready. Failed loads return to the globe with a retry message. City changes route through the globe, landmarks participate in browser history, and scene visibility plus picking filters prevent overlapping local coordinate systems from mixing. Its bottom-right attribution line switches source credit by city and also exposes the unobtrusive internal link to the crawlable blog.
- `viewport-lifecycle.ts` suspends and resumes animation based on page visibility and viewport presence.

Continue reducing this orchestration layer by moving cohesive controllers out with typed inputs. It must retain one persistent renderer and must not remount between geographic views.

San Diego uses fixed authored cameras in its overview and both landmark views. Wheel/pinch, landmark selection, and tour navigation use the guided flow, while dragging cannot orbit or pan San Diego. The disabled authoring implementation remains available behind its flag: it synchronizes displayed and desired poses, preserves selected tour captions, supports Reset and Copy view, and skips resize fitting after manual adjustments. San Diego retains its sage background, neutral-warm lighting, and longer camera far plane.

There are no direct subfolders.
