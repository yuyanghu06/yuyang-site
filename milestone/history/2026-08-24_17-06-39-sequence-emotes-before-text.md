# Sequence emotes before streamed text

Established the runtime rule that avatar emotes complete before their accompanying text appears. The agent prompt requests the emote tool before response text, and `AgentChat` now pauses talking presentation and text reveal while awaiting a completion-aware avatar-emote request.

The shared player resolves the request only after the one-shot finishes and returns to idle. Missing registry entries resolve immediately rather than hanging the response; interrupted actions also release their prior completion gate. ESLint, TypeScript, and diff checks pass.
