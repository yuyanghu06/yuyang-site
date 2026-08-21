# Reject DOM face and fix arms-down export

- Meshy rigged the optimized v2 under task `01a02257-9730-76fa-8410-ce0a57bcfa08` for five credits.
- Posed upper arms +32°/-32° in Blender, but the first skinned GLB reopened in its original A-pose; its attempted website integration was rejected.
- The temporary site prototype also positioned the face atlas as a DOM element independent of the canvas/model. Responsive scaling visibly detached it from the head. Removed the entire temporary live-model component and CSS immediately, restoring the approved image placeholder.
- Built a corrected static model by applying the evaluated armature deformation directly to the arms-down mesh, detaching the rig, normalizing the lost inherited scale from 170 units to 1.7 meters, and exporting `public/models/yuyang-avatar-arms-down-static.glb`.
- Reimported the exact GLB into Blender and rendered `public/style-references/avatar/yuyang-avatar-arms-down-static-export-audit.png`. The audit confirms vertical relaxed arms, correct proportions, 1.7-meter scale, and 39,604 faces.
- Targeted ESLint and TypeScript checks pass after restoring the website.
- Next integration must bind the atlas inside the model's actual material/UV mapping and pass visual review before replacing the placeholder.
