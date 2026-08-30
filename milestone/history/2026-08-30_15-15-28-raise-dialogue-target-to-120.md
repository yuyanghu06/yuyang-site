# Raise dialogue target to 120

- Raised the single viewport-independent dialogue soft target from 85 to 120 characters.
- Retuned every authored camera script to use the additional caption space with conversational, self-contained beats.
- Updated the site-agent base prompt to write roughly 120-character sentences or thoughts while allowing answers of any total length.
- Confirmed overflow remains manual: captions advance only through the blue Next button, while the similarly named internal callback only streams characters within the current caption.
- Targeted ESLint, full TypeScript, and whitespace validation pass.
