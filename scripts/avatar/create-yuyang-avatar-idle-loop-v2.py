"""Apply the standard-library Idle_Loop to the authoritative full hand rig."""

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
retarget.BLEND_OUTPUT = ROOT / "assets/blender/yuyang-avatar-idle-loop-v2.blend"
retarget.GLB_OUTPUT = ROOT / "public/models/yuyang-avatar-idle-loop-v2.glb"
retarget.REVIEW_DIR = ROOT / "data/work/avatar-idle-loop-v2"
retarget.CLIPS = {"Idle_Loop": "Yuyang_Idle_Loop_v2"}
retarget.LOCK_ARMS = False
# Importing into the avatar's 30 fps scene scales the library's native
# 0-60/24 fps action to 0-75 frames; sample that imported range at 30 fps.
retarget.SOURCE_FPS = 30


if __name__ == "__main__":
    retarget.main()
