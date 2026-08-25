# Flat illustrated avatar preview

Extended the isolated `/avatar-emote-preview` route with the complete low-geometry-crease rendering experiment. The preview omits normal maps, removes specular response with roughness `1` and metalness `0`, makes body materials 85% texture-emissive, sharply reduces hemisphere and directional lights, disables the camera point light, and adds a broad low-contrast screen gradient.

The production renderer retains its existing four-step toon defaults because the new treatment is opt-in. The preview route returns HTTP 200 and passes ESLint and TypeScript.
