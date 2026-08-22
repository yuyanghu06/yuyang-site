# Cross-hand weight and arm-direction repair

- User inspection rejected the first isolated adapter because its arms remained in the fallback pose and the mesh still formed cross-body bars.
- A 25-frame evaluated-mesh audit traced the bars to 87 right-hand vertices with opposite-side arm/finger influences, particularly `LeftPinky3` weights as high as 43%.
- Removed only those spatially impossible opposite-side influences and renormalized surviving same-side weights.
- Replaced only shoulder, upper-arm, forearm, and hand rotations with physical joint-direction retargeting; body, legs, neck, head, and finger tracks remain otherwise unchanged.
- Produced `public/models/yuyang-avatar-vrm1-idle-direction-arms-weight-fixed-review.glb`. Its midpoint x-ray has no crossed arm chains, and the maximum audited stretched edge fell from about 0.226 m to 0.032 m.
- The candidate remains undeployed pending user inspection.
