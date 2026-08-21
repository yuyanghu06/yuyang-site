# Crack-free blank-face smoothing

- The user identified rough central facial shading on the Meshy-native blank-face model.
- A first localized Laplacian vertex-smoothing pass exposed Meshy's unwelded facial seams as visible cracks. That pass was rejected and fully reverted from `Mesh_0_PreFaceSmooth` before saving.
- Replaced it with a displacement-free correction: smooth shading/normals on 749 front-head polygons only. No vertices moved, so the original continuous surface, silhouette, hairline, ears, jaw, neck, UVs, and rig remain intact.
- Saved the accepted preview as `public/style-references/avatar/yuyang-avatar-meshy-blank-face-smoothed-front-v2.png`.
- Re-exported `public/models/yuyang-avatar-meshy-blank-face.glb` and verified a successful GLB import round-trip with the armature, main 15,702-face mesh, and auxiliary 80-face mesh present.
