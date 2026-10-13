# Separate San Diego development branch

The user authorized committing and pushing the completed San Diego work to a completely separate development branch. Created `codex/dev-san-diego-expansion` from `317a2438d85e31d2b69aaec15942c7f8b83723de`, preserving the existing `dev` ref. Destination: `origin` (`yuyanghu06/yuyang-site`).

The release packages the expanded region and district navigation, OSM snapshot and generated model/data, camera/terrain/shadow/road QA corrections, Torrey Pines ridge, smaller Park Village waterfall rocks, dialogue, responsive controls, and documentation/history. The final regional GLB hash is `99b84b005c115ff910e941bc72911caaf407a2cf8bb82ee9db3a7e0d64e837b0`; original Torrey Highlands assets are unchanged.

Fresh `npm run build` passes optimized compilation, TypeScript, all 18 generated static pages, and final optimization without warnings/errors. Git status and tracked-content hashes are unchanged by the build. Existing geometry, camera, responsive, and independent verification is documented in the preceding session records. Publication proceeds through final staged review, an ordinary commit, and upstream push. No force push, PR, merge, or manual deployment is part of the request.
