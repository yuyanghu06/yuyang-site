"""Add library-compatible three-joint digit chains to the original hand mesh."""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/yuyang-avatar-library-idles.blend"
BLEND_OUTPUT = ROOT / "assets/blender/yuyang-avatar-hand-rig-v2.blend"
GLB_OUTPUT = ROOT / "public/models/yuyang-avatar-hand-rig-v2.glb"


FINGER_LABELS = ("Pinky", "Ring", "Middle", "Index")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def hand_coordinates(mesh: bpy.types.Object, group_name: str, side_sign: float):
    group = mesh.vertex_groups[group_name]
    vertices = [
        vertex
        for vertex in mesh.data.vertices
        if any(element.group == group.index and element.weight > 0.25 for element in vertex.groups)
    ]
    points = [vertex.co.copy() for vertex in vertices]
    zmax = max(point.z for point in points)
    zmin = min(point.z for point in points)
    wrist_points = [point for point in points if point.z > zmax - 2.5]
    tip_points = [point for point in points if point.z < zmin + 3.5]
    wrist = sum(wrist_points, Vector()) / len(wrist_points)
    tip = sum(tip_points, Vector()) / len(tip_points)
    length_axis = (tip - wrist).normalized()
    depth_axis = Vector((0.0, 1.0, 0.0))
    side_axis = depth_axis.cross(length_axis).normalized()
    if side_axis.x * side_sign < 0:
        side_axis.negate()

    records = []
    for vertex in vertices:
        relative = vertex.co - wrist
        records.append(
            {
                "index": vertex.index,
                "s": relative.dot(length_axis),
                "u": relative.dot(side_axis),
                "v": relative.dot(depth_axis),
            }
        )
    return wrist, length_axis, side_axis, depth_axis, records


def quantile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    blend = position - lower
    return ordered[lower] * (1.0 - blend) + ordered[upper] * blend


def add_hand_bones(
    armature: bpy.types.Object,
    side: str,
    wrist: Vector,
    length_axis: Vector,
    side_axis: Vector,
    depth_axis: Vector,
    records,
):
    hand_bone = armature.data.edit_bones[f"{side}Hand"]
    finger_records = [record for record in records if record["s"] > 9.0 and record["u"] > -2.1]
    thresholds = [quantile([record["v"] for record in finger_records], q) for q in (0.25, 0.5, 0.75)]
    finger_centers = []
    edges = [-float("inf"), *thresholds, float("inf")]
    for index in range(4):
        bucket = [record for record in finger_records if edges[index] <= record["v"] < edges[index + 1]]
        finger_centers.append(sum(record["v"] for record in bucket) / len(bucket))

    created = {}
    for label, depth in zip(FINGER_LABELS, finger_centers):
        chain = []
        points = (8.7, 10.8, 12.9, 15.0)
        parent = hand_bone
        for joint in range(3):
            bone = armature.data.edit_bones.new(f"{side}{label}{joint + 1}")
            bone.head = wrist + length_axis * points[joint] + depth_axis * depth
            bone.tail = wrist + length_axis * points[joint + 1] + depth_axis * depth
            bone.parent = parent
            bone.use_connect = joint > 0
            bone.use_deform = True
            chain.append(bone.name)
            parent = bone
        created[label] = chain

    thumb_points = [record for record in records if record["u"] < -2.4 and 0.5 < record["s"] < 12.0]
    thumb_center_s = sum(record["s"] for record in thumb_points) / len(thumb_points)
    thumb_center_u = sum(record["u"] for record in thumb_points) / len(thumb_points)
    thumb_center_v = sum(record["v"] for record in thumb_points) / len(thumb_points)
    thumb_root = wrist + length_axis * 3.0 + side_axis * -2.0 + depth_axis * thumb_center_v
    thumb_tip = (
        wrist
        + length_axis * max(thumb_center_s + 2.0, 7.0)
        + side_axis * min(thumb_center_u - 1.0, -4.5)
        + depth_axis * thumb_center_v
    )
    thumb_chain = []
    parent = hand_bone
    for joint in range(3):
        bone = armature.data.edit_bones.new(f"{side}Thumb{joint + 1}")
        bone.head = thumb_root.lerp(thumb_tip, joint / 3.0)
        bone.tail = thumb_root.lerp(thumb_tip, (joint + 1) / 3.0)
        bone.parent = parent
        bone.use_connect = joint > 0
        bone.use_deform = True
        thumb_chain.append(bone.name)
        parent = bone
    created["Thumb"] = thumb_chain
    return created, thresholds


def assign_weights(
    mesh: bpy.types.Object,
    side: str,
    records,
    created: dict[str, list[str]],
    thresholds: list[float],
):
    hand_group = mesh.vertex_groups[f"{side}Hand"]
    groups = {
        label: [mesh.vertex_groups.new(name=name) for name in names]
        for label, names in created.items()
    }
    edges = [-float("inf"), *thresholds, float("inf")]

    for record in records:
        label = None
        joint = 0
        weight = 0.0
        if record["u"] < -2.4 and 0.5 < record["s"] < 12.0:
            label = "Thumb"
            weight = clamp((-record["u"] - 2.2) / 2.5, 0.0, 0.92)
            weight *= clamp((record["s"] - 1.0) / 4.0, 0.15, 1.0)
            joint = min(2, max(0, int(clamp((record["s"] - 2.0) / 3.0, 0.0, 2.999))))
        elif record["s"] > 8.0 and record["u"] > -2.1:
            bucket = next(
                index
                for index in range(4)
                if edges[index] <= record["v"] < edges[index + 1]
            )
            label = FINGER_LABELS[bucket]
            weight = clamp((record["s"] - 8.0) / 5.0, 0.0, 0.92)
            joint = min(2, max(0, int(clamp((record["s"] - 8.7) / 2.1, 0.0, 2.999))))

        if label and weight > 0.0:
            groups[label][joint].add([record["index"]], weight, "REPLACE")
            hand_group.add([record["index"]], 1.0 - weight, "REPLACE")


def evaluated_positions(mesh: bpy.types.Object) -> list[Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    return [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]


def export(armature: bpy.types.Object, mesh: bpy.types.Object) -> None:
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
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_def_bones=True,
        export_skins=True,
    )


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)
    )
    bpy.context.scene.frame_set(1)
    before = evaluated_positions(mesh)

    hand_data = {}
    for side, sign in (("Left", 1.0), ("Right", -1.0)):
        hand_data[side] = hand_coordinates(mesh, f"{side}Hand", sign)

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    rig_data = {}
    for side, (wrist, length_axis, side_axis, depth_axis, records) in hand_data.items():
        created, thresholds = add_hand_bones(
            armature, side, wrist, length_axis, side_axis, depth_axis, records
        )
        rig_data[side] = (created, thresholds)
    bpy.ops.object.mode_set(mode="OBJECT")

    for side, (_wrist, _length_axis, _side_axis, _depth_axis, records) in hand_data.items():
        created, thresholds = rig_data[side]
        assign_weights(mesh, side, records, created, thresholds)

    bpy.context.view_layer.update()
    after = evaluated_positions(mesh)
    neutral_delta = max((a - b).length for a, b in zip(before, after))
    if neutral_delta > 1e-6:
        raise RuntimeError(f"Neutral hand rig changed the mesh: {neutral_delta}")

    export(armature, mesh)
    print(
        "HAND_BONES",
        sorted(
            bone_name
            for created, _thresholds in rig_data.values()
            for chain in created.values()
            for bone_name in chain
        ),
    )
    print(f"NEUTRAL_MAX_VERTEX_DELTA {neutral_delta:.9f}")


if __name__ == "__main__":
    main()
