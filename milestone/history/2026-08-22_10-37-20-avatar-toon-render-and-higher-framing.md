# Avatar toon render and higher framing

The fullscreen avatar canvas moved upward by two percentage points while the minimized crop and authoritative GLB remain unchanged.

The browser renderer now converts body, hair, and clothing MeshStandard materials to four-step MeshToon materials, preserving their color and texture inputs while omitting glossy physical response. The animated illustrated face remains on its existing cloned MeshStandard canvas material so blinking and talking continue unchanged. Runtime toon resources are included in normal renderer cleanup.
