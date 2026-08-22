# VRM animation retargeting

This folder contains the minimum VRM Game Starter retargeting implementation copied from the separately cloned upstream repository at commit `b14c236fd8150855348ad085b7820c298eac4b30`. The upstream code is MIT-licensed; animation assets remain separately licensed.

## Files

- `VrmAnimation.ts` transfers source motion as world-space rest-pose deltas onto normalized VRM humanoid bones.
- `VrmAnimationContract.ts` maps the Quaternius library's deform bones to VRM 1.0 humanoid bone names.
- `VrmMeta.ts` distinguishes VRM 0.x and VRM 1.0 metadata behavior.
- `VrmTargetRestPose.ts` captures the raw target skeleton rest pose used during retargeting.
- `INFO.md` documents this folder.

There are no direct subfolders.
