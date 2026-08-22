# Boat hull waterline

Replaced the shared boat-center route radius with a scale-aware radius for each boat. The carrier now sits at `water radius + hull radius × boat scale`, placing the bottom of every differently scaled capsule hull on the measured globe water surface while preserving route, speed, and orientation.
