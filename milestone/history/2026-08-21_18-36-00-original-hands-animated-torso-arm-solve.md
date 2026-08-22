# Original hands and animated-torso arm solve

- Restored the recovered animation tracks for both hand bones and all 30 finger bones at user request.
- Retained the localized removal of 87 opposite-side hand influences so the long cross-body mesh spikes cannot return.
- Limited the reusable joint-direction retargeter to shoulders, upper arms, and forearms.
- Corrected shoulder local rotations against the target torso's animated world transform on every frame rather than its rest transform.
- Produced `public/models/yuyang-avatar-vrm1-idle-direction-arms-original-hands-torso-corrected-review.glb`; its midpoint x-ray shows symmetric uncrossed arm chains with both elbows forward/down.
- Nothing is deployed pending direct user inspection.
