# Uncover arch and map crossings

- Confirmed in Blender that the exported nine-mesh white arch has a real opening and stepped details.
- Identified the visible website block as CityGML BIN `1088400`, not the GLB, and excluded that duplicate massing building.
- Extended the OSM crop parser to include tagged node elements.
- Replaced hand-estimated crosswalks with actual `highway=crossing` nodes oriented from their connected footway segments.
- Changes remain local and were not committed or pushed.
