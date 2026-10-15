# Fullscreen composer implementation

Role: coder, integrated by orchestrator. Scope: persistent fullscreen bottom-left composer, then user refinements to light liquid glass, arrow-only send, no focus boundary and white placeholder/typed text.

agent-chat.tsx now renders one shared composer as an expanded bottom form or docked inline Reply form, retaining draft, submission ref, pending/blank/length guards and Enter submission. Expanded Reply focuses the persistent input without hiding choices. Submitting cancels active scripted caption reveal before branching to the existing agent flow. Bottom form is excluded from landscape avatar measurement. agent-chat.css provides nonshrinking bottom anchoring, independently scrolling history, mobile transcript spacing, glass input, white text and placeholder, no added focus ring, and arrow button. styles/INFO.md documents behavior. Parent components/info.md is updated by orchestrator.

Coder checks passed: targeted ESLint, full no-incremental TypeScript and scoped whitespace; follow-up CSS refinements passed targeted lint and whitespace without unnecessary repeat TypeScript. Browser review at 1512×688, 390×844 and 844×390 confirms bottom placement and no horizontal overflow. Empty text is blocked; Enter and arrow click submit through pending state. Reply preserves Next. Draft survives fullscreen→docked Reply→fullscreen with one input. Computed focused input has white placeholder/text and outline:none. Physical mobile keyboard and Safari are not measured.

Concurrent tour-helper/source and map/dialogue changes remain preserved. No backend changes, production build, commit or publication. Independent evaluator final signoff pending.
