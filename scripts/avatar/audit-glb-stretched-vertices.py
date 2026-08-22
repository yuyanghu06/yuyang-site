"""Report mesh edges whose armature deformation stretches far beyond bind length."""

import argparse
from pathlib import Path
import sys

import bpy


argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--samples", type=int, default=13)
args = parser.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
action = armature.animation_data.action if armature.animation_data else None
if not action:
    raise RuntimeError("Imported GLB has no active animation")

rest = [mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices]
first, last = action.frame_range
frames = [round(first + (last - first) * i / (args.samples - 1)) for i in range(args.samples)]
worst = {}
for frame in frames:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    deformed_mesh = evaluated.to_mesh()
    deformed = [evaluated.matrix_world @ vertex.co for vertex in deformed_mesh.vertices]
    for edge in mesh.data.edges:
        a, b = edge.vertices
        rest_length = (rest[a] - rest[b]).length
        current_length = (deformed[a] - deformed[b]).length
        ratio = current_length / max(rest_length, 1e-8)
        score = (ratio, current_length, frame)
        if score > worst.get((a, b), (0.0, 0.0, 0)):
            worst[(a, b)] = score
    evaluated.to_mesh_clear()

suspect_edges = sorted(worst.items(), key=lambda item: item[1], reverse=True)[:40]
suspect_vertices = sorted({index for edge, _ in suspect_edges[:20] for index in edge})
print("WORST_EDGES")
for (a, b), (ratio, length, frame) in suspect_edges:
    print(f"edge={a},{b} ratio={ratio:.3f} length={length:.6f} frame={frame}")
print("SUSPECT_WEIGHTS")
for index in suspect_vertices:
    vertex = mesh.data.vertices[index]
    weights = sorted(
        ((mesh.vertex_groups[group.group].name, group.weight) for group in vertex.groups),
        key=lambda item: item[1],
        reverse=True,
    )
    print(f"vertex={index} co={tuple(round(v, 6) for v in vertex.co)} weights={weights}")
