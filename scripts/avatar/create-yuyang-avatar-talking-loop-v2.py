"""Apply the standard-library Idle_Talking_Loop to the full hand V2 rig."""

from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RETARGET_SCRIPT = Path(__file__).with_name("retarget-quaternius-idles.py")

spec = importlib.util.spec_from_file_location("retarget_quaternius_idles", RETARGET_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load {RETARGET_SCRIPT}")
retarget = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retarget)

retarget.AVATAR_SOURCE = ROOT / "assets/blender/yuyang-avatar-hand-rig-v2.blend"
retarget.BLEND_OUTPUT = ROOT / "assets/blender/yuyang-avatar-talking-loop-v2.blend"
retarget.GLB_OUTPUT = ROOT / "public/models/yuyang-avatar-talking-loop-v2.glb"
retarget.REVIEW_DIR = ROOT / "data/work/avatar-talking-loop-v2"
retarget.CLIPS = {"Idle_Talking_Loop": "Yuyang_Talking_Loop_v2"}
retarget.LOCK_ARMS = False
# The first talking pass only mapped the upper arms, which left the hands rigid
# and allowed one silhouette to swing across the thigh. Map the complete arm and
# digit hierarchy, then damp the library motion for this compact avatar.
retarget.BONE_MAP.update(
    {
        "clavicle_l": "LeftShoulder",
        "lowerarm_l": "LeftForeArm",
        "hand_l": "LeftHand",
        "clavicle_r": "RightShoulder",
        "lowerarm_r": "RightForeArm",
        "hand_r": "RightHand",
    }
)
for side_source, side_target in (("l", "Left"), ("r", "Right")):
    for source_digit, target_digit in (
        ("thumb", "Thumb"),
        ("index", "Index"),
        ("middle", "Middle"),
        ("ring", "Ring"),
        ("pinky", "Pinky"),
    ):
        for joint in range(1, 4):
            retarget.BONE_MAP[f"{source_digit}_0{joint}_{side_source}"] = (
                f"{side_target}{target_digit}{joint}"
            )

retarget.MOTION_SCALES = {
    "LeftShoulder": 0.20,
    "RightShoulder": 0.20,
    "LeftArm": 0.12,
    "RightArm": 0.12,
    "LeftForeArm": 0.30,
    "RightForeArm": 0.30,
    "LeftHand": 0.35,
    "RightHand": 0.35,
}
for target_side in ("Left", "Right"):
    for target_digit in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
        for joint in range(1, 4):
            retarget.MOTION_SCALES[f"{target_side}{target_digit}{joint}"] = 0.30
# Import into the 30 fps target scene scales the library's native timing.
retarget.SOURCE_FPS = 30


if __name__ == "__main__":
    retarget.main()
