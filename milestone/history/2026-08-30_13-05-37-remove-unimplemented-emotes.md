# Remove unimplemented agent emotes

Reduced the shared avatar-emote enum from eight values to the three animations actually wired into the production runtime: `wave_hello`, `nod_smile`, and `head_shake_disappointed`. This automatically narrows the strict OpenAI tool schema and command parser, preventing requests for five no-op emotes.

Targeted ESLint and TypeScript verification passed.
