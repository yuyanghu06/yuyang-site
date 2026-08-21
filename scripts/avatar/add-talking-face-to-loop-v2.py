"""Bind the approved 2D talking atlas to the V2 talking body loop."""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/yuyang-avatar-talking-loop-v2.blend"
OUTPUT = ROOT / "assets/blender/yuyang-avatar-talking-loop-face-v2.blend"
ATLAS = ROOT / "public/style-references/avatar/yuyang-avatar-face-talking-atlas.png"
REVIEW_DIR = ROOT / "data/work/avatar-talking-loop-face-v2"

FRAME_START = 1
FRAME_END = 89

# Atlas states: neutral, half blink, closed blink, small, medium, wide,
# rounded, smiling talk. The schedule uses short four-frame mouth holds and
# closes on the exact neutral state used at frame one.
TALK_SEQUENCE = [3, 4, 3, 6, 4, 5, 3, 7, 4, 3, 6, 3, 5, 4, 3]


def state_for_frame(frame: int) -> int:
    if frame in {1, FRAME_END}:
        return 0
    # Two blink arcs occur during closed-mouth pauses.
    blink_states = {28: 1, 29: 2, 30: 1, 66: 1, 67: 2, 68: 1}
    if frame in blink_states:
        return blink_states[frame]
    if frame < 5 or 25 <= frame <= 32 or 63 <= frame <= 70 or frame >= 85:
        return 0
    return TALK_SEQUENCE[((frame - 5) // 4) % len(TALK_SEQUENCE)]


def create_canvas(armature: bpy.types.Object) -> bpy.types.Object:
    old = bpy.data.objects.get("Yuyang_BlankFace_Canvas")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    columns, rows = 12, 16
    width, height = 0.205, 0.255
    center_x, center_y, center_z = -0.004, -0.166, 1.440
    vertices = []
    uvs = []
    for row in range(rows + 1):
        v = row / rows
        z = center_z + (v - 0.5) * height
        for column in range(columns + 1):
            u = column / columns
            x_normalized = (u - 0.5) * 2.0
            x = center_x + (u - 0.5) * width
            # Follow the convex face: center sits foremost; edges recede.
            y = center_y + 0.025 * (x_normalized * x_normalized)
            vertices.append((x, y, z))
            uvs.append((u, v))

    faces = []
    for row in range(rows):
        for column in range(columns):
            a = row * (columns + 1) + column
            b = a + 1
            d = (row + 1) * (columns + 1) + column
            c = d + 1
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Yuyang_BlankFace_Canvas_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    canvas = bpy.data.objects.new("Yuyang_BlankFace_Canvas", mesh)
    bpy.context.scene.collection.objects.link(canvas)

    uv_layer = mesh.uv_layers.new(name="Face2D_UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]

    group = canvas.vertex_groups.new(name="Head")
    group.add(list(range(len(vertices))), 1.0, "REPLACE")
    modifier = canvas.modifiers.new(name="FaceHeadDeform", type="ARMATURE")
    modifier.object = armature
    canvas["face_system"] = "approved_2d_atlas_v1_no_cheeks"
    return canvas


def create_material(canvas: bpy.types.Object) -> None:
    material = bpy.data.materials.new("Yuyang_TalkingFace_Atlas")
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = 0.7
    shader.inputs["Specular IOR Level"].default_value = 0.15
    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.name = "FaceAtlasMapping"
    mapping.inputs["Scale"].default_value = (0.25, 0.5, 1.0)
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(ATLAS), check_existing=True)
    texture.extension = "CLIP"
    texture.interpolation = "Cubic"
    saturation = nodes.new("ShaderNodeHueSaturation")
    saturation.name = "FaceColorDepth"
    saturation.inputs["Saturation"].default_value = 1.45
    saturation.inputs["Value"].default_value = 0.72
    contrast = nodes.new("ShaderNodeBrightContrast")
    contrast.name = "FaceContrast"
    contrast.inputs["Contrast"].default_value = 0.22

    links = material.node_tree.links
    links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], texture.inputs["Vector"])
    links.new(texture.outputs["Color"], saturation.inputs["Color"])
    links.new(saturation.outputs["Color"], contrast.inputs["Color"])
    links.new(contrast.outputs["Color"], shader.inputs["Base Color"])
    links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])
    if "Emission Color" in shader.inputs:
        links.new(contrast.outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = 0.08
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    canvas.data.materials.append(material)

    location = mapping.inputs["Location"]
    for frame in range(FRAME_START, FRAME_END + 1):
        state = state_for_frame(frame)
        column = state % 4
        row = state // 4
        location.default_value = (column * 0.25, 0.5 if row == 0 else 0.0, 0.0)
        location.keyframe_insert("default_value", frame=frame)
    # Every frame is explicitly keyed, so no interpolation interval can expose
    # a partial atlas tile even under Blender's layered-action system.


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    canvas = create_canvas(armature)
    create_material(canvas)

    scene = bpy.context.scene
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    # Review the avatar head-on so atlas placement is not obscured by the
    # earlier three-quarter camera foreshortening.
    camera = scene.camera
    camera.location = (0.0, -4.8, 0.85)
    camera.rotation_euler = (Vector((0.0, 0.0, 0.85)) - camera.location).to_track_quat(
        "-Z", "Y"
    ).to_euler()
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    scene.frame_set(FRAME_START)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT))

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(REVIEW_DIR / "frame-")
    bpy.ops.render.render(animation=True)
    print(f"CREATED talking body + face loop: {FRAME_START}-{FRAME_END}")


if __name__ == "__main__":
    main()
