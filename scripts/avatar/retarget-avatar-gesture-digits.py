"""Correct a gesture GLB's hand and finger chains from a Quaternius source clip."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


target_path = Path(sys.argv[-4]).resolve()
source_path = Path(sys.argv[-3]).resolve()
output_path = Path(sys.argv[-2]).resolve()
source_action_name = sys.argv[-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(target_path))
target = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
target_action = next(action for action in bpy.data.actions if action.name == "Thumbs_Up")
target.animation_data_create()
target.animation_data.action = target_action

before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(source_path))
source = next(obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "ARMATURE")
source_action = next(action for action in bpy.data.actions if action.name == source_action_name)
source.animation_data_create()
source.animation_data.action = source_action

digit_names = ("Thumb", "Index", "Middle", "Ring", "Pinky")
mapping: list[tuple[str, str]] = [("LeftHand", "hand_l")]
source_digit_names = {"Thumb": "thumb", "Index": "index", "Middle": "middle", "Ring": "ring", "Pinky": "pinky"}
for digit in digit_names:
    for joint in range(1, 4):
        mapping.append((f"Left{digit}{joint}", f"{source_digit_names[digit]}_0{joint}_l"))

scene = bpy.context.scene
target_start, target_end = (int(round(value)) for value in target_action.frame_range)
source_start, source_end = source_action.frame_range
scene.frame_set(target_start)
reference_upper_arm = target.pose.bones["LeftArm"].matrix_basis.copy()
reference_forearm = target.pose.bones["LeftForeArm"].matrix_basis.copy()
reference_local = {
    name: target.pose.bones[name].matrix_basis.copy()
    for name, _ in mapping
}

for target_frame in range(target_start, target_end + 1):
    normalized = (target_frame - target_start) / max(target_end - target_start, 1)
    source_frame = source_start + normalized * (source_end - source_start)
    base_frame = math.floor(source_frame)
    scene.frame_set(base_frame, subframe=source_frame - base_frame)
    source.update_tag(refresh={"OBJECT"})
    bpy.context.view_layer.update()
    source_directions: dict[str, Vector] = {}
    for target_name, source_name in mapping:
        source_bone = source.pose.bones[source_name]
        world_direction = (source.matrix_world.to_3x3() @ (source_bone.tail - source_bone.head)).normalized()
        source_directions[target_name] = (target.matrix_world.to_3x3().inverted_safe() @ world_direction).normalized()

    scene.frame_set(target_frame)
    gesture_strength = math.sin(math.pi * normalized) ** 0.8
    upper_arm = target.pose.bones["LeftArm"]
    upper_arm.matrix_basis = reference_upper_arm
    upper_arm.rotation_mode = "QUATERNION"
    upper_arm.keyframe_insert(data_path="rotation_quaternion", frame=target_frame, group="LeftArm")
    bpy.context.view_layer.update()
    forearm = target.pose.bones["LeftForeArm"]
    forearm.matrix_basis = reference_forearm
    bpy.context.view_layer.update()
    neutral_forearm_direction = (forearm.tail - forearm.head).normalized()
    raised_forearm_direction = Vector((0.18, -0.35, 0.92)).normalized()
    desired_forearm_direction = neutral_forearm_direction.lerp(raised_forearm_direction, gesture_strength).normalized()
    forearm_swing = neutral_forearm_direction.rotation_difference(desired_forearm_direction)
    forearm.matrix = Matrix.Translation(forearm.head) @ (forearm_swing.to_matrix() @ forearm.matrix.to_3x3()).to_4x4()
    forearm.rotation_mode = "QUATERNION"
    forearm.keyframe_insert(data_path="rotation_quaternion", frame=target_frame, group="LeftForeArm")
    for target_name, _ in mapping:
        target.pose.bones[target_name].matrix_basis = reference_local[target_name]
    bpy.context.view_layer.update()

    for target_name, _ in mapping:
        bone = target.pose.bones[target_name]
        current_direction = (bone.tail - bone.head).normalized()
        desired_direction = source_directions[target_name]
        swing = current_direction.rotation_difference(desired_direction)
        new_rotation = swing.to_matrix() @ bone.matrix.to_3x3()
        bone.matrix = Matrix.Translation(bone.head) @ new_rotation.to_4x4()
        bone.rotation_mode = "QUATERNION"
        bone.keyframe_insert(data_path="rotation_quaternion", frame=target_frame, group=target_name)
        bpy.context.view_layer.update()

# Preserve the approved neutral hand/finger bookend exactly.
for frame in (target_start, target_end):
    scene.frame_set(frame)
    upper_arm = target.pose.bones["LeftArm"]
    upper_arm.matrix_basis = reference_upper_arm
    upper_arm.keyframe_insert(data_path="rotation_quaternion", frame=frame, group="LeftArm")
    forearm = target.pose.bones["LeftForeArm"]
    forearm.matrix_basis = reference_forearm
    forearm.keyframe_insert(data_path="rotation_quaternion", frame=frame, group="LeftForeArm")
    for target_name, _ in mapping:
        bone = target.pose.bones[target_name]
        bone.matrix_basis = reference_local[target_name]
        bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=target_name)

for obj in list(bpy.context.scene.objects):
    if obj is source or obj.parent is source:
        bpy.data.objects.remove(obj, do_unlink=True)
target_action.name = "Thumbs_Up"
target_action.use_fake_user = True
target.animation_data.action = target_action
for action in list(bpy.data.actions):
    if action is not target_action:
        bpy.data.actions.remove(action)
bpy.ops.object.select_all(action="DESELECT")
target.select_set(True)
for obj in bpy.context.scene.objects:
    if obj.type == "MESH" and obj.find_armature() is target:
        obj.select_set(True)
bpy.context.view_layer.objects.active = target
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_def_bones=True,
    export_skins=True,
)
print(f"Wrote corrected gesture digits: {output_path}")
