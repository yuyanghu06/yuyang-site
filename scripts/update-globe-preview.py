import bpy
import math
import os

PROJECT = "/Users/yuyang/Documents/YuyangSite/backend"
BLEND = os.path.join(PROJECT, "assets/blender/lowpoly-earth-yellow-facet-preview.blend")
OUTPUT = os.path.join(PROJECT, "public/style-references/lowpoly-earth-yellow-facet-preview.png")

bpy.ops.wm.open_mainfile(filepath=BLEND)
land = bpy.data.objects["Land_LightSage_Preview"]

# Geographic ellipses are intentionally conservative. A boundary facet only
# becomes warm when its center falls inside a real arid belt; all remaining
# continents retain the approved uniform green.
arid_regions = [
    (10.0, 25.0, 29.0, 11.5),   # Sahara
    (47.0, 23.0, 15.0, 9.0),    # Arabian Peninsula
    (67.0, 39.0, 20.0, 8.0),    # Central Asia
    (101.0, 42.0, 22.0, 8.0),   # Gobi / Taklamakan
    (134.0, -25.0, 22.0, 12.0), # Australian interior
    (-112.0, 31.0, 14.0, 8.0),  # US Southwest / northern Mexico
    (-71.0, -23.0, 6.0, 13.0),  # Atacama
    (22.0, -25.0, 12.0, 9.0),   # Namib / Kalahari
    (-69.0, -44.0, 12.0, 8.0),  # Patagonia
]

warm_count = 0
bpy.context.view_layer.update()
for polygon in land.data.polygons:
    direction = (land.matrix_world @ polygon.center).normalized()
    latitude = math.degrees(math.asin(max(-1.0, min(1.0, direction.z))))
    longitude = math.degrees(math.atan2(direction.y, direction.x))
    arid_strength = 0.0
    for center_lon, center_lat, radius_lon, radius_lat in arid_regions:
        # The authored model's prime-meridian axis is +90 degrees from WGS84.
        model_center_lon = center_lon + 90.0
        if model_center_lon > 180.0:
            model_center_lon -= 360.0
        lon_delta = abs(longitude - model_center_lon)
        lon_delta = min(lon_delta, 360.0 - lon_delta)
        distance = (lon_delta / radius_lon) ** 2 + ((latitude - center_lat) / radius_lat) ** 2
        if distance <= 1.0:
            arid_strength = max(arid_strength, 1.0 - distance)
    if arid_strength <= 0.0:
        polygon.material_index = 0
        continue
    # Deterministic variation gives neighboring desert facets two restrained
    # values without scattering yellow across non-arid continents.
    facet_hash = (polygon.index * 1103515245 + 12345) & 0x7FFFFFFF
    polygon.material_index = 2 if facet_hash % 5 == 0 else 1
    warm_count += 1

land.data.update()

# Render an Africa-centered close preview so the Sahara placement is legible.
camera = bpy.context.scene.camera
preview_lon = math.radians(100.0)
preview_lat = math.radians(20.0)
camera.location = (
    3.75 * math.cos(preview_lat) * math.cos(preview_lon),
    3.75 * math.cos(preview_lat) * math.sin(preview_lon),
    3.75 * math.sin(preview_lat),
)
camera.data.lens = 54
direction = -camera.location
camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUTPUT
scene.render.film_transparent = False
scene.world.color = (0.0, 0.0, 0.0)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.render.render(write_still=True)
print({"warm_facets": warm_count, "total_facets": len(land.data.polygons), "output": OUTPUT})
