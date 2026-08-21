"""Create the first seamless production idle for the rigged blank-face V2 avatar."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/yuyang-avatar-arms-down.blend"
BLEND_OUTPUT = ROOT / "assets/blender/yuyang-avatar-idle-v1.blend"
GLB_OUTPUT = ROOT / "public/models/yuyang-avatar-idle-v1.glb"
PREVIEW_OUTPUT = ROOT / "public/style-references/avatar/yuyang-avatar-idle-v1.mp4"
PREVIEW_FRAMES = ROOT / "data/work/avatar-idle-v1-frames"

FPS = 30
START_FRAME = 1
END_FRAME = 121
SAMPLE_STEP = 5


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.armatures,
        bpy.data.meshes,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.materials,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_avatar() -> tuple[bpy.types.Object, bpy.types.Object]:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)
    )

    for obj in list(bpy.context.scene.objects):
        if obj not in {armature, mesh}:
            bpy.data.objects.remove(obj, do_unlink=True)

    armature.name = "YuyangAvatarRig"
    mesh.name = "YuyangAvatar"
    return armature, mesh


def wave(phase: float, cycles: float = 1.0, offset: float = 0.0) -> float:
    return math.sin(math.tau * cycles * phase + offset)


def set_rotation(bone: bpy.types.PoseBone, xyz_degrees: tuple[float, float, float]) -> None:
    x, y, z = (math.radians(value) for value in xyz_degrees)
    bone.rotation_mode = "XYZ"
    bone.rotation_euler = (x, y, z)


def keyframe_bone(bone: bpy.types.PoseBone, frame: int) -> None:
    bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
    bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)


def create_idle(armature: bpy.types.Object) -> bpy.types.Action:
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    for bone in armature.pose.bones:
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)

    action = bpy.data.actions.new("Yuyang_Idle_Natural_Loop_v1")
    armature.animation_data_create()
    armature.animation_data.action = action

    bones = armature.pose.bones
    animated_names = [
        "Hips",
        "Spine02",
        "Spine01",
        "Spine",
        "LeftShoulder",
        "RightShoulder",
        "LeftArm",
        "RightArm",
        "LeftForeArm",
        "RightForeArm",
        "neck",
        "Head",
    ]

    for frame in range(START_FRAME, END_FRAME + 1, SAMPLE_STEP):
        phase = (frame - START_FRAME) / (END_FRAME - START_FRAME)
        breath = 0.5 - 0.5 * math.cos(math.tau * phase)
        sway = wave(phase)
        sway_slow = wave(phase, offset=0.35)
        settle = wave(phase, cycles=2.0, offset=0.6)

        hips = bones["Hips"]
        hips.location = Vector((0.0, 0.0, 0.0045 * breath))
        set_rotation(hips, (0.18 * settle, 0.28 * sway, 0.38 * sway_slow))

        set_rotation(bones["Spine02"], (-0.25 * breath, -0.20 * sway, -0.25 * sway_slow))
        set_rotation(bones["Spine01"], (-0.42 * breath, -0.17 * sway, -0.28 * sway_slow))
        set_rotation(bones["Spine"], (-0.55 * breath, -0.10 * sway, -0.22 * sway_slow))

        shoulder_lift = -0.48 * breath
        set_rotation(bones["LeftShoulder"], (0.0, 0.0, shoulder_lift + 0.10 * sway))
        set_rotation(bones["RightShoulder"], (0.0, 0.0, -shoulder_lift + 0.10 * sway))

        # The authored rest pose still leaves a small A-shaped gap. Carry both
        # upper arms the remaining distance down so the hands rest beside the
        # thighs, then keep their idle follow-through deliberately tiny.
        set_rotation(bones["LeftArm"], (0.10 * sway, 0.06 * settle, 22.0 + 0.12 * sway_slow))
        set_rotation(bones["RightArm"], (-0.10 * sway, -0.06 * settle, -22.0 - 0.12 * sway_slow))
        set_rotation(bones["LeftForeArm"], (0.13 * settle, 0.10 * sway, -0.18 * sway_slow))
        set_rotation(bones["RightForeArm"], (-0.13 * settle, -0.10 * sway, -0.18 * sway_slow))
        set_rotation(bones["neck"], (0.12 * breath, 0.0, -0.16 * sway_slow))
        set_rotation(bones["Head"], (0.10 * settle, -0.24 * sway, -0.28 * sway_slow))

        for name in animated_names:
            keyframe_bone(bones[name], frame)

    # Guarantee numerical identity at the loop boundary.
    for name in animated_names:
        bone = bones[name]
        for path in ("location", "rotation_euler"):
            first_values = tuple(getattr(bone, path))
            # The sampled periodic functions already return the same values; explicitly
            # keying the terminal pose avoids exporter-dependent extrapolation.
            bone.keyframe_insert(data_path=path, frame=END_FRAME, group=name)

    bpy.ops.object.mode_set(mode="OBJECT")

    action.use_fake_user = True
    return action


def add_preview_scene(mesh: bpy.types.Object) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    PREVIEW_FRAMES.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = FPS
    scene.render.filepath = str(PREVIEW_FRAMES / "frame-")
    scene.render.film_transparent = False
    scene.world.color = (0.055, 0.065, 0.063)

    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    center = sum(corners, Vector()) / 8.0
    height = max(c.z for c in corners) - min(c.z for c in corners)

    camera_data = bpy.data.cameras.new("IdleReviewCamera")
    camera = bpy.data.objects.new("IdleReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (center.x + height * 1.30, center.y - height * 2.65, center.z + height * 0.02)
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.12
    scene.camera = camera

    key_data = bpy.data.lights.new("IdleKey", type="AREA")
    key_data.energy = 900
    key_data.shape = "DISK"
    key_data.size = height * 1.2
    key = bpy.data.objects.new("IdleKey", key_data)
    scene.collection.objects.link(key)
    key.location = (center.x - height, center.y - height * 1.5, center.z + height)
    key.rotation_euler = (math.radians(35), 0.0, math.radians(-28))

    fill_data = bpy.data.lights.new("IdleFill", type="AREA")
    fill_data.energy = 500
    fill_data.size = height
    fill = bpy.data.objects.new("IdleFill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = (center.x + height, center.y - height, center.z + height * 0.35)
    fill.rotation_euler = (math.radians(60), 0.0, math.radians(145))

    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_plane_add(size=height * 4, location=(center.x, center.y, min(c.z for c in corners) - 0.01))
    bpy.context.object.name = "IdleFloor"


def export(armature: bpy.types.Object, mesh: bpy.types.Object) -> None:
    bpy.context.scene.frame_start = START_FRAME
    bpy.context.scene.frame_end = END_FRAME
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_set(START_FRAME)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
        export_def_bones=True,
        export_skins=True,
    )


def main() -> None:
    clean_scene()
    armature, mesh = import_avatar()
    action = create_idle(armature)
    add_preview_scene(mesh)
    export(armature, mesh)
    bpy.context.scene.render.filepath = str(PREVIEW_FRAMES / "frame-")
    bpy.ops.render.render(animation=True)
    print(f"Created {action.name}: {START_FRAME}-{END_FRAME} at {FPS} fps")
    print(f"Blend: {BLEND_OUTPUT}")
    print(f"GLB: {GLB_OUTPUT}")
    print(f"Preview: {PREVIEW_OUTPUT}")


if __name__ == "__main__":
    main()
