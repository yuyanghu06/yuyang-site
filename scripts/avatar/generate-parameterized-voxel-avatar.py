"""Generate a deterministic, rigged voxel-hybrid avatar from an editable JSON preset.

Run with Blender:
  blender --background --python scripts/avatar/generate-parameterized-voxel-avatar.py -- \
    scripts/avatar/yuyang-voxel-avatar-v1.json
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PRESET = ROOT / "scripts/avatar/yuyang-voxel-avatar-v2.json"
BLEND_OUT = ROOT / "assets/blender/yuyang-voxel-avatar-review-v4.blend"
GLB_OUT = ROOT / "public/models/yuyang-voxel-avatar-review-v4.glb"
PREVIEW_OUT = ROOT / "public/style-references/avatar/yuyang-voxel-avatar-review-v4.png"


def hex_rgba(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def material(name: str, color: str, roughness=0.72):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = hex_rgba(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_box(parts, name, center, size, mat, bone, bevel=0.0, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Soft voxel edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj["deform_bone"] = bone
    parts.append(obj)
    return obj


def add_voxel(parts, name, xyz, size, mat, bone, bevel):
    return add_box(parts, name, xyz, (size, size, size), mat, bone, bevel)


def join_and_rigid_weight(parts, armature):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = "Yuyang_VoxelAvatar_Merged"

    # Material-based connected components remain one selectable/skinned object.
    for vertex in mesh.data.vertices:
        vertex.select = False
    # Joining loses custom per-object tags, so assign rigid weights spatially.
    groups = {name: mesh.vertex_groups.new(name=name) for name in [
        "Hips", "Spine", "Chest", "Neck", "Head",
        "UpperArm.L", "LowerArm.L", "Hand.L",
        "UpperArm.R", "LowerArm.R", "Hand.R",
        "UpperLeg.L", "LowerLeg.L", "Foot.L",
        "UpperLeg.R", "LowerLeg.R", "Foot.R",
    ]}
    for v in mesh.data.vertices:
        x, y, z = v.co
        if z > 2.57:
            bone = "Head"
        elif z > 2.46:
            bone = "Neck"
        elif abs(x) > 0.54 and z > 1.68:
            side = "L" if x > 0 else "R"
            bone = f"Hand.{side}" if z < 1.92 else (f"LowerArm.{side}" if z < 2.28 else f"UpperArm.{side}")
        elif z > 1.96:
            bone = "Chest"
        elif z > 1.66:
            bone = "Spine"
        elif z > 1.48:
            bone = "Hips"
        elif abs(x) > 0.22:
            side = "L" if x > 0 else "R"
            bone = f"UpperLeg.{side}" if z > 0.88 else (f"LowerLeg.{side}" if z > 0.28 else f"Foot.{side}")
        else:
            bone = "Hips"
        groups[bone].add([v.index], 1.0, "REPLACE")

    arm_mod = mesh.modifiers.new("Voxel humanoid armature", "ARMATURE")
    arm_mod.object = armature
    mesh.parent = armature
    return mesh


def create_armature():
    data = bpy.data.armatures.new("YuyangVoxelRig")
    rig = bpy.data.objects.new("YuyangVoxelRig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name, head, tail, parent=None, connected=False):
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = data.edit_bones[parent]
            b.use_connect = connected
        return b

    bone("Root", (0, 0, 0), (0, 0, 0.18))
    bone("Hips", (0, 0, 1.48), (0, 0, 1.67), "Root")
    bone("Spine", (0, 0, 1.67), (0, 0, 2.02), "Hips", True)
    bone("Chest", (0, 0, 2.02), (0, 0, 2.40), "Spine", True)
    bone("Neck", (0, 0, 2.40), (0, 0, 2.58), "Chest", True)
    bone("Head", (0, 0, 2.58), (0, 0, 3.20), "Neck", True)
    for side, sign in (("L", 1), ("R", -1)):
        bone(f"UpperArm.{side}", (0.47 * sign, 0, 2.34), (0.56 * sign, 0, 2.04), "Chest")
        bone(f"LowerArm.{side}", (0.56 * sign, 0, 2.04), (0.56 * sign, 0, 1.70), f"UpperArm.{side}", True)
        bone(f"Hand.{side}", (0.56 * sign, 0, 1.70), (0.56 * sign, 0, 1.45), f"LowerArm.{side}", True)
        bone(f"UpperLeg.{side}", (0.24 * sign, 0, 1.50), (0.25 * sign, 0, 0.91), "Hips")
        bone(f"LowerLeg.{side}", (0.25 * sign, 0, 0.91), (0.25 * sign, 0, 0.28), f"UpperLeg.{side}", True)
        bone(f"Foot.{side}", (0.25 * sign, 0, 0.28), (0.25 * sign, -0.23, 0.13), f"LowerLeg.{side}", True)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.data.display_type = "OCTAHEDRAL"
    return rig


def build_avatar(cfg):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass

    p, a = cfg["proportions"], cfg["appearance"]
    v, bevel = p["voxelSize"], p["edgeBevel"]
    mats = {k: material(k, value, 0.68 if k in {"hair", "hairHighlight", "shoes"} else 0.78) for k, value in a.items()}
    white = material("eyeWhite", "#F4EFE5", 0.76)
    mouth = material("mouth", "#6D3D35", 0.8)
    parts = []

    # Hybrid body: large beveled blocks with rigid joint segmentation.
    add_box(parts, "Torso", (0, 0, 2.04), (0.88, 0.43, 0.86), mats["shirt"], "Chest", 0.045)
    add_box(parts, "Neck", (0, 0, 2.52), (0.20, 0.22, 0.18), mats["skin"], "Neck", 0.022)
    add_box(parts, "Undershirt", (0, -0.01, 1.59), (0.77, 0.44, 0.10), mats["undershirt"], "Hips", 0.018)
    add_box(parts, "Hips", (0, 0, 1.48), (0.66, 0.40, 0.24), mats["pants"], "Hips", 0.025)
    for side, sign in (("L", 1), ("R", -1)):
        add_box(parts, f"Sleeve.{side}", (0.55 * sign, 0, 2.22), (0.27, 0.39, 0.52), mats["shirt"], f"UpperArm.{side}", 0.038)
        add_box(parts, f"Forearm.{side}", (0.56 * sign, 0, 1.80), (0.195, 0.26, 0.40), mats["skin"], f"LowerArm.{side}", 0.030)
        add_box(parts, f"Palm.{side}", (0.56 * sign, -0.005, 1.55), (0.205, 0.27, 0.22), mats["skinHighlight"], f"Hand.{side}", 0.030)
        for finger_index in (-1, 0, 1):
            add_box(parts, f"Finger.{side}.{finger_index}", ((0.56 + finger_index * 0.055) * sign, -0.005, 1.405), (0.052, 0.25, 0.13), mats["skinHighlight"], f"Hand.{side}", 0.014)
        add_box(parts, f"Thumb.{side}", (0.475 * sign, -0.105, 1.56), (0.060, 0.095, 0.13), mats["skinHighlight"], f"Hand.{side}", 0.014)
        add_box(parts, f"Thigh.{side}", (0.22 * sign, 0, 1.16), (0.34, 0.40, 0.66), mats["pants"], f"UpperLeg.{side}", 0.028)
        add_box(parts, f"Shin.{side}", (0.22 * sign, 0, 0.56), (0.32, 0.37, 0.66), mats["pants"], f"LowerLeg.{side}", 0.026)
        add_box(parts, f"Shoe.{side}", (0.25 * sign, -0.12, 0.16), (0.36, 0.62, 0.25), mats["shoes"], f"Foot.{side}", 0.025)
    # The head uses a denser grid than the body so illustrated features survive
    # voxelization. Row widths form a rounded silhouette rather than a rectangle.
    head_center = Vector((0, 0, 3.05))
    fv = v * 0.56
    face_bevel = min(bevel, fv * 0.12)
    row_half_width = {-8: 3, -7: 5, -6: 6, -5: 7, -4: 7, -3: 8, -2: 8, -1: 8,
                      0: 8, 1: 8, 2: 8, 3: 8, 4: 8, 5: 7, 6: 7, 7: 6, 8: 4}
    for iz, half_width in row_half_width.items():
        for ix in range(-half_width, half_width + 1):
            radial = min(1.0, (ix / 8.5) ** 2 + (iz / 9.0) ** 2)
            front_y = -0.075 - 0.075 * (1.0 - radial)
            add_voxel(parts, f"Face_{ix}_{iz}", head_center + Vector((ix * fv, front_y, iz * fv)), fv * 1.02, mats["skinHighlight"], "Head", face_bevel)

    # Stepped side and rear shells turn the illustrated face into a genuine
    # rounded voxel volume. Only shell cells are emitted to keep the mesh light.
    for depth in range(1, 8):
        y = depth * fv - 0.04
        inset = 0 if depth < 4 else depth - 3
        for iz, base_half_width in row_half_width.items():
            half_width = max(1, base_half_width - inset // 2)
            for ix in range(-half_width, half_width + 1):
                is_side = abs(ix) == half_width
                is_rear = depth == 7
                is_top_bottom = abs(iz) >= 7
                if is_side or is_rear or is_top_bottom:
                    add_voxel(parts, f"HeadShell_{depth}_{ix}_{iz}", head_center + Vector((ix * fv, y, iz * fv)), fv, mats["skin"], "Head", face_bevel)

    # Ears and block nose.
    for sign in (-1, 1):
        for iz in range(-2, 3):
            add_voxel(parts, f"Ear_{sign}_{iz}", head_center + Vector((sign * 9 * fv, 0, iz * fv)), fv, mats["skin"], "Head", face_bevel)
    add_box(parts, "NoseBridge", (0, -0.205, 3.03), (fv * 0.42, 0.012, fv * 2.4), mats["skin"], "Head", 0.002)
    add_box(parts, "NoseTip", (fv * 0.45, -0.212, 2.975), (fv * 1.1, 0.014, fv * 0.38), mats["skin"], "Head", 0.002)

    # Eyes and brows on the front plane (camera faces -Y).
    for sign in (-1, 1):
        ex = sign * 3.6 * fv
        add_box(parts, f"EyeWhite.{sign}", (ex, -0.202, 3.15), (fv * 3.5, 0.012, fv * 2.0), white, "Head", 0.003)
        add_box(parts, f"Eye.{sign}", (ex, -0.211, 3.15), (fv * 1.35, 0.009, fv * 1.72), mats["eye"], "Head", 0.002)
        add_box(parts, f"EyeHighlight.{sign}", (ex - sign * fv * 0.25, -0.218, 3.19), (fv * 0.34, 0.006, fv * 0.38), white, "Head", 0.001)
        add_box(parts, f"Brow.{sign}", (ex, -0.205, 3.32), (fv * 3.3, 0.012, fv * 0.48), mats["brow"], "Head", 0.003, (0, 0, sign * math.radians(5)))
    add_box(parts, "SmileCenter", (0, -0.205, 2.80), (fv * 2.5, 0.012, fv * 0.34), mouth, "Head", 0.002)
    add_box(parts, "Smile.L", (fv * 1.65, -0.205, 2.825), (fv * 1.25, 0.012, fv * 0.30), mouth, "Head", 0.002, (0, 0, math.radians(16)))
    add_box(parts, "Smile.R", (-fv * 1.65, -0.205, 2.825), (fv * 1.25, 0.012, fv * 0.30), mouth, "Head", 0.002, (0, 0, -math.radians(16)))

    # Tousled center-part hair: layered voxels with a broken fringe.
    hair_cells = []
    for ix in range(-9, 10):
        for iz in range(5, 12):
            if abs(ix) + max(0, iz - 7) <= 12:
                hair_cells.append((ix, iz, 0))
    hair_cells += [(-9, 0, 0), (-9, 2, 0), (-8, 4, 0), (-7, 4, -1), (-5, 5, -1),
                   (5, 5, -1), (7, 4, -1), (8, 4, 0), (9, 2, 0), (9, 0, 0),
                   (-7, 11, 1), (-3, 12, 0), (0, 11, 0), (3, 12, 0), (7, 11, 1)]
    for n, (ix, iz, depth) in enumerate(hair_cells):
        mat = mats["hairHighlight"] if (ix + iz) % 5 == 0 else mats["hair"]
        add_voxel(parts, f"Hair_{n}", head_center + Vector((ix * fv, depth * fv - 0.19, iz * fv)), fv * 1.035, mat, "Head", face_bevel)
    # Back/side hair volume.
    for iy in range(1, 5):
        for ix in range(-8, 9):
            for iz in range(0, 11):
                if abs(ix) + iz < 18 and (iy == 4 or abs(ix) >= 6 or iz >= 8):
                    add_voxel(parts, f"HairBack_{iy}_{ix}_{iz}", head_center + Vector((ix * fv, iy * fv, iz * fv)), fv, mats["hair"], "Head", face_bevel)

    rig = create_armature()
    mesh = join_and_rigid_weight(parts, rig)
    mesh["avatar_parameters"] = json.dumps(cfg, separators=(",", ":"))
    return rig, mesh


def setup_render(rig):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.82, 0.82, 0.80)
    scene.view_settings.look = "AgX - Medium High Contrast"

    # Relaxed review pose without changing the exported rest skeleton.
    for side, sign in (("L", 1), ("R", -1)):
        rig.pose.bones[f"UpperArm.{side}"].rotation_mode = "XYZ"
        rig.pose.bones[f"UpperArm.{side}"].rotation_euler[1] = sign * math.radians(7)
        rig.pose.bones[f"LowerArm.{side}"].rotation_mode = "XYZ"
        rig.pose.bones[f"LowerArm.{side}"].rotation_euler[1] = sign * math.radians(3)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "ReviewGround"
    ground.data.materials.append(material("Ground", "#D8D6D1", 0.88))

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.2, 6.2))
    bpy.context.object.data.energy = 950
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 4.0
    bpy.context.object.rotation_euler = (math.radians(24), 0, math.radians(-34))
    bpy.ops.object.light_add(type="AREA", location=(3.5, 1.0, 4.2))
    bpy.context.object.data.energy = 600
    bpy.context.object.data.size = 3.0
    bpy.context.object.rotation_euler = (math.radians(-25), 0, math.radians(145))

    bpy.ops.object.camera_add(location=(5.0, -7.5, 3.7))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4.55
    direction = Vector((0, 0, 1.95)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = str(PREVIEW_OUT)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preset_path = Path(argv[0]).resolve() if argv else DEFAULT_PRESET
    cfg = json.loads(preset_path.read_text())
    rig, mesh = build_avatar(cfg)
    setup_render(rig)

    # Export only the merged skinned avatar and its armature, in neutral rest pose.
    bpy.context.scene.render.filepath = str(PREVIEW_OUT)
    bpy.ops.render.render(write_still=True)
    rig.data.pose_position = "REST"
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(GLB_OUT), export_format="GLB", use_selection=True, export_apply=True)
    rig.data.pose_position = "POSE"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT))
    print(json.dumps({"blend": str(BLEND_OUT), "glb": str(GLB_OUT), "preview": str(PREVIEW_OUT)}))


if __name__ == "__main__":
    main()
