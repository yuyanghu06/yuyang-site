# Branch mid-dialogue replies

Submitting an inline reply now exits the active guided-tour or landmark-script branch and clears its unseen queue, shown-segment navigation state, and pending backward destination. The model still receives the assistant text that was actually displayed before the visitor reply.

The generated answer owns a fresh terminal state, so its Next controls reveal only its own renderer-created segments and can no longer resume the original scripted dialogue. Targeted ESLint, TypeScript, and diff validation pass.
