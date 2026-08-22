"""Render a posed GLB skeleton through a translucent mesh for rig inspection."""

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--hands", action="store_true")
    parser.add_argument("--side", choices=("left", "right"))
    parser.add_argument("--frame-ratio", type=float, default=0.5)
    return parser.parse_args(argv)


def material(name, color, alpha=1.0, emission=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, alpha)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Alpha"].default_value = alpha
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Emission Color"].default_value = (*color, 1.0)
    shader.inputs["Emission Strength"].default_value = emission
    if alpha < 1.0:
        value.surface_render_method = "DITHERED"
    return value


def cylinder_between(start, end, radius, value):
    delta = end - start
    if delta.length < 1e-6:
        return
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=delta.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.data.materials.append(value)


def sphere_at(position, radius, value):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=position)
    bpy.context.object.data.materials.append(value)


args = parse_args()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
action = armature.animation_data.action if armature.animation_data else None
if action:
    first, last = action.frame_range
    bpy.context.scene.frame_set(round(first + (last - first) * args.frame_ratio))
bpy.context.view_layer.update()

mesh_mat = material("XRayMesh", (0.29, 0.34, 0.31), 0.07 if args.hands else 0.26)
bone_mat = material("XRayBones", (0.54, 0.88, 1.0), 1.0, 0.35)
joint_mat = material("XRayJoints", (1.0, 0.63, 0.28), 1.0, 0.25)
for obj in meshes:
    obj.data.materials.clear()
    obj.data.materials.append(mesh_mat)

corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
body_height = max(point.z for point in corners) - min(point.z for point in corners)
bone_radius = body_height * (0.006 if not args.hands else 0.008)
joint_radius = bone_radius * 1.8
chosen = []
for bone in armature.pose.bones:
    lower = bone.name.lower()
    if args.hands and not any(token in lower for token in ("hand", "thumb", "index", "middle", "ring", "pinky", "little")):
        continue
    if args.side and args.side not in lower:
        continue
    start = armature.matrix_world @ bone.head
    end = armature.matrix_world @ bone.tail
    chosen.append((start, end))
    cylinder_between(start, end, bone_radius, bone_mat)
    sphere_at(start, joint_radius, joint_mat)
    sphere_at(end, joint_radius, joint_mat)

focus_points = [point for pair in chosen for point in pair] if args.hands else corners
minimum = Vector((min(p.x for p in focus_points), min(p.y for p in focus_points), min(p.z for p in focus_points)))
maximum = Vector((max(p.x for p in focus_points), max(p.y for p in focus_points), max(p.z for p in focus_points)))
center = (minimum + maximum) / 2
width = maximum.x - minimum.x
height = maximum.z - minimum.z
bpy.ops.object.camera_add(location=(center.x, minimum.y - body_height * 2.8, center.z))
camera = bpy.context.object
camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = max(height * 1.14, width * (0.72 if args.hands else 1.22))
bpy.context.scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=(center.x - body_height, minimum.y - body_height, center.z + body_height))
bpy.context.object.data.energy = 900
bpy.context.object.data.shape = "DISK"
bpy.context.object.data.size = body_height * 3

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200 if args.hands else 1600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(Path(args.output).resolve())
scene.world = scene.world or bpy.data.worlds.new("XRayWorld")
scene.world.color = (0.025, 0.025, 0.03)
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)
print(f"Rendered skeleton x-ray: {scene.render.filepath}")
