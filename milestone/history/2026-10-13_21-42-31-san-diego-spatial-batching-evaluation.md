# San Diego spatial batching evaluation

Role: orchestrator integrating coder and independent evaluator evidence.

A deterministic 500 m background partition preserved every one of the 439,083 oriented world triangles, Float32 positions, normals, colors, landmark transforms and materials. All population/source/layout values remained exact. It reduced background triangle submissions by 67.57–91.20% in authored close-ups, but raised normal mesh draw calls substantially. Candidate generation was deterministic.

Actual Chrome standalone GPU-timer comparison with app-matched lights, shadow settings, fixed cameras and DPR 1.5 found no consistent GPU gain and increased CPU submission overhead by roughly 0.3–0.6 ms. Three BatchedMesh multi-draw also added GPU shader overhead; a 600 m candidate did not resolve the tradeoff. These results measure an isolated map without site UI/population, not end-to-end application FPS.

Decision: reject spatial batching and BatchedMesh for this pass. The coder restored only its own changes, then regenerated the original eight-mesh model/manifest/layout byte-identically against the saved dirty baseline. Original model is 7,506,908 bytes; SHA256 eca6e8141563ba184bd4f45c5e5712a1ac0af367f181eb2774cf6ead134e295d. Both population files restored exactly. Syntax, targeted lint and whitespace pass. Diagnostics remain outside the repo at `/tmp/yuyang-sd-optimization/`; no helper or modified batching asset ships.

Runtime/glow/static-matrix/audio optimizations remain active. Concrete final follow-up: protect SD shadow caching from shared renderer invalidations caused by hidden NYC asynchronous tile loads. Independent final runtime review and live site checks remain.
