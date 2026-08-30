# Live agent status and visitor voice

- Replaced the anonymous pending dots with transient `Thinking…` and RAG-specific `Remembering…` states.
- Hardened the base prompt so the site agent is Yuyang Hu, speaks about his own life in the first person, and uses a casual conversational tone.
- Prohibited coaching-style follow-up offers and option menus.
- Removed numbered/source labels from memory evidence and stopped streaming citation metadata to the browser.
- Verified targeted ESLint, TypeScript, and a live RAG response. The live stream produced `thinking → remembering → thinking → answer`, used first-person Shift language, exposed no citation markers, and ended without a follow-up menu.
