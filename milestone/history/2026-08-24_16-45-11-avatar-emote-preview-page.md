# Avatar emote preview page

Added the isolated `/avatar-emote-preview` route for reviewing two candidate one-shots without changing production behavior. Its ten-second script cycles through neutral, nod with open smile, neutral, head shake with disappointed eyes and frown, and neutral.

The preview uses the production idle GLB and renderer, applies head/neck offsets only after the idle mixer evaluates, and composites facial states only in the preview canvas. The base site, GLBs, startup wave, semantic emote allowlist, and approved face assets remain unchanged. The route returns HTTP 200 and passes ESLint and TypeScript. Visual browser review remains pending because no controllable browser was available.
