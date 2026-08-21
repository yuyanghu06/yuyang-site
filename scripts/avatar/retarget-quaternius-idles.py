"""Retarget the two Quaternius standard idles to the Yuyang avatar rig."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[2]
AVATAR_SOURCE = ROOT / "assets/blender/yuyang-avatar-arms-down.blend"
LIBRARY_SOURCE = Path(
    "/Users/yuyang/Downloads/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
)
BLEND_OUTPUT = ROOT / "assets/blender/yuyang-avatar-library-idles.blend"
GLB_OUTPUT = ROOT / "public/models/yuyang-avatar-library-idles.glb"
REVIEW_DIR = ROOT / "data/work/avatar-library-idles"
PUBLIC_REVIEW_DIR = ROOT / "public/style-references/avatar"

SOURCE_FPS = 24
OUTPUT_FPS = 30

BONE_MAP = {
    "pelvis": "Hips",
    "spine_01": "Spine02",
    "spine_02": "Spine01",
    "spine_03": "Spine",
    "neck_01": "neck",
    "Head": "Head",
    "upperarm_l": "LeftArm",
    "upperarm_r": "RightArm",
    "thigh_l": "LeftUpLeg",
    "calf_l": "LeftLeg",
    "foot_l": "LeftFoot",
    "ball_l": "LeftToeBase",
    "thigh_r": "RightUpLeg",
    "calf_r": "RightLeg",
    "foot_r": "RightFoot",
    "ball_r": "RightToeBase",
}

CLIPS = {
    "Idle_Loop": "Yuyang_Idle_Quaternius",
    "Idle_Talking_Loop": "Yuyang_Idle_Talking_Quaternius",
}

LOCK_ARMS = True
MOTION_SCALES: dict[str, float] = {}


def load_avatar() -> tuple[bpy.types.Object, bpy.types.Object]:
    bpy.ops.wm.open_mainfile(filepath=str(AVATAR_SOURCE))
    target = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)
    )
    target.name = "YuyangAvatarRig"
    mesh.name = "YuyangAvatar"
    for obj in list(bpy.context.scene.objects):
        if obj not in {target, mesh}:
            bpy.data.objects.remove(obj, do_unlink=True)
    target.animation_data_create()
    target.animation_data.action = None
    return target, mesh


def import_library(target: bpy.types.Object, mesh: bpy.types.Object) -> bpy.types.Object:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(LIBRARY_SOURCE))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    source = next(obj for obj in imported if obj.type == "ARMATURE")
    source.name = "QuaterniusSourceRig"
    for obj in imported:
        if obj is not source:
            bpy.data.objects.remove(obj, do_unlink=True)
    source.hide_render = True
    # The source must remain dependency-graph visible while its actions are
    # sampled. Hiding it in the viewport freezes pose evaluation in Blender.
    source.hide_viewport = False
    source.animation_data_create()
    return source


def rest_parent_rotation(bone: bpy.types.Bone):
    matrix = bone.matrix_local
    if bone.parent:
        matrix = bone.parent.matrix_local.inverted_safe() @ matrix
    return matrix.to_quaternion().normalized()


def skeleton_height(armature: bpy.types.Object) -> float:
    points = [bone.head_local.z for bone in armature.data.bones]
    points.extend(bone.tail_local.z for bone in armature.data.bones)
    return max(points) - min(points)


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion.identity()
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.scale = Vector((1.0, 1.0, 1.0))


def retarget_clip(
    source: bpy.types.Object,
    target: bpy.types.Object,
    source_action: bpy.types.Action,
    target_name: str,
) -> tuple[bpy.types.Action, int]:
    source.animation_data.action = source_action
    source_start, source_end = source_action.frame_range
    duration_seconds = (source_end - source_start) / SOURCE_FPS
    terminal_frame = max(2, round(duration_seconds * OUTPUT_FPS) + 1)

    action = bpy.data.actions.new(target_name)
    action.use_fake_user = True
    target.animation_data.action = action
    height_ratio = skeleton_height(target) / skeleton_height(source)

    conversions = {}
    for source_name, target_name_bone in BONE_MAP.items():
        qs = rest_parent_rotation(source.data.bones[source_name])
        qt = rest_parent_rotation(target.data.bones[target_name_bone])
        conversions[source_name] = qt.inverted() @ qs

    scene = bpy.context.scene
    scene.frame_set(math.floor(source_start), subframe=source_start - math.floor(source_start))
    source_reference_rotations = {
        source_name: source.pose.bones[source_name].matrix_basis.to_quaternion().normalized()
        for source_name in BONE_MAP
    }
    source_reference_hips = source.pose.bones["pelvis"].location.copy()
    for output_frame in range(1, terminal_frame + 1):
        normalized = (output_frame - 1) / (terminal_frame - 1)
        source_frame = source_start + (source_end - source_start) * normalized
        base_frame = math.floor(source_frame)
        scene.frame_set(base_frame, subframe=source_frame - base_frame)
        reset_pose(target)

        for source_name, target_name_bone in BONE_MAP.items():
            source_pose = source.pose.bones[source_name]
            target_pose = target.pose.bones[target_name_bone]
            conversion = conversions[source_name]
            source_delta = (
                source_reference_rotations[source_name].inverted()
                @ source_pose.matrix_basis.to_quaternion()
            ).normalized()
            mapped_delta = (
                conversion
                @ source_delta
                @ conversion.inverted()
            ).normalized()
            motion_scale = MOTION_SCALES.get(target_name_bone, 1.0)
            if motion_scale != 1.0:
                mapped_delta = Quaternion().slerp(mapped_delta, motion_scale).normalized()
            target_pose.rotation_quaternion = mapped_delta
            if target_name_bone == "LeftArm":
                base_rotation = Quaternion((0.0, 0.0, 1.0), math.radians(22.0))
                target_pose.rotation_quaternion = (
                    base_rotation if LOCK_ARMS else base_rotation @ mapped_delta
                ).normalized()
            elif target_name_bone == "RightArm":
                base_rotation = Quaternion((0.0, 0.0, 1.0), math.radians(-22.0))
                target_pose.rotation_quaternion = (
                    base_rotation if LOCK_ARMS else base_rotation @ mapped_delta
                ).normalized()
            target_pose.keyframe_insert(
                data_path="rotation_quaternion", frame=output_frame, group=target_name_bone
            )

        source_hips = source.pose.bones["pelvis"]
        target_hips = target.pose.bones["Hips"]
        target_hips.location = (source_hips.location - source_reference_hips) * height_ratio
        # These are in-place dialogue idles: preserve vertical breathing but
        # discard root drift that would slide the avatar around its modal.
        target_hips.location.x = 0.0
        target_hips.location.y = 0.0
        target_hips.keyframe_insert(data_path="location", frame=output_frame, group="Hips")

    # Force exact loop closure on the target, independent of source interpolation.
    scene.frame_set(1)
    first_pose = {
        name: (
            target.pose.bones[name].rotation_quaternion.copy(),
            target.pose.bones[name].location.copy(),
        )
        for name in set(BONE_MAP.values())
    }
    for name, (rotation, location) in first_pose.items():
        bone = target.pose.bones[name]
        bone.rotation_quaternion = rotation
        bone.location = location
        bone.keyframe_insert(data_path="rotation_quaternion", frame=terminal_frame, group=name)
        bone.keyframe_insert(data_path="location", frame=terminal_frame, group=name)

    return action, terminal_frame


def add_review_scene(mesh: bpy.types.Object) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = OUTPUT_FPS
    scene.render.film_transparent = False
    scene.world.color = (0.055, 0.065, 0.063)

    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    center = sum(corners, Vector()) / 8.0
    height = max(c.z for c in corners) - min(c.z for c in corners)
    floor_z = min(c.z for c in corners) - 0.01

    camera_data = bpy.data.cameras.new("IdleComparisonCamera")
    camera = bpy.data.objects.new("IdleComparisonCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (center.x + height * 1.30, center.y - height * 2.65, center.z + height * 0.02)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.12
    scene.camera = camera

    for name, energy, size, location, rotation in (
        (
            "IdleKey",
            900,
            height * 1.2,
            (center.x - height, center.y - height * 1.5, center.z + height),
            (math.radians(35), 0.0, math.radians(-28)),
        ),
        (
            "IdleFill",
            500,
            height,
            (center.x + height, center.y - height, center.z + height * 0.35),
            (math.radians(60), 0.0, math.radians(145)),
        ),
    ):
        light_data = bpy.data.lights.new(name, type="AREA")
        light_data.energy = energy
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = rotation

    bpy.ops.mesh.primitive_plane_add(size=height * 4, location=(center.x, center.y, floor_z))
    bpy.context.object.name = "IdleFloor"


def export_avatar(
    target: bpy.types.Object,
    mesh: bpy.types.Object,
    actions: dict[str, tuple[bpy.types.Action, int]],
) -> None:
    primary_source_name = next(iter(CLIPS))
    target.animation_data.action = actions[primary_source_name][0]
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = actions[primary_source_name][1]
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))

    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_def_bones=True,
        export_skins=True,
    )


def validate_motion(
    target: bpy.types.Object, actions: dict[str, tuple[bpy.types.Action, int]]
) -> None:
    scene = bpy.context.scene
    for source_name, (action, terminal_frame) in actions.items():
        target.animation_data.action = action
        sampled_frames = (1, 1 + (terminal_frame - 1) // 4, 1 + (terminal_frame - 1) // 2)
        samples = []
        for frame in sampled_frames:
            scene.frame_set(frame)
            samples.append(
                {
                    bone.name: tuple(value for row in bone.matrix for value in row)
                    for bone in target.pose.bones
                }
            )
        max_delta = max(
            abs(a - b)
            for bone_name in samples[0]
            for sample in samples[1:]
            for a, b in zip(samples[0][bone_name], sample[bone_name])
        )
        if max_delta < 1e-4:
            raise RuntimeError(f"Retargeted action {source_name} is static: {max_delta}")
        scene.frame_set(1)
        first = {
            bone.name: tuple(value for row in bone.matrix for value in row)
            for bone in target.pose.bones
        }
        scene.frame_set(terminal_frame)
        terminal = {
            bone.name: tuple(value for row in bone.matrix for value in row)
            for bone in target.pose.bones
        }
        loop_delta = max(
            abs(a - b)
            for bone_name in first
            for a, b in zip(first[bone_name], terminal[bone_name])
        )
        if loop_delta > 1e-6:
            raise RuntimeError(f"Retargeted action {source_name} does not loop: {loop_delta}")
        print(f"VALIDATED {source_name}: motion_delta={max_delta:.6f}, loop_delta={loop_delta:.6f}")


def render_reviews(
    target: bpy.types.Object, actions: dict[str, tuple[bpy.types.Action, int]]
) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    for source_name, (action, terminal_frame) in actions.items():
        target.animation_data.action = action
        scene.frame_start = 1
        scene.frame_end = terminal_frame
        output_dir = REVIEW_DIR / source_name
        output_dir.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(output_dir / "frame-")
        scene.frame_set(1)
        bpy.ops.render.render(animation=True)
        print(f"REVIEW {source_name} {terminal_frame - 1} frames -> {output_dir}")


def main() -> None:
    target, mesh = load_avatar()
    source = import_library(target, mesh)
    source_actions = {action.name: action for action in bpy.data.actions if action.name in CLIPS}
    missing = set(CLIPS) - set(source_actions)
    if missing:
        raise RuntimeError(f"Missing source actions: {sorted(missing)}")

    actions = {
        source_name: retarget_clip(source, target, source_actions[source_name], target_name)
        for source_name, target_name in CLIPS.items()
    }
    source.animation_data.action = None
    bpy.data.objects.remove(source, do_unlink=True)
    retained_actions = {action for action, _terminal_frame in actions.values()}
    for action in list(bpy.data.actions):
        if action not in retained_actions:
            bpy.data.actions.remove(action)
    add_review_scene(mesh)
    validate_motion(target, actions)
    export_avatar(target, mesh, actions)
    render_reviews(target, actions)


if __name__ == "__main__":
    main()
