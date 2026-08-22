# Caption scroll limit

- Added sufficient invisible scroll room after scripted controls so the caption history can honor its authored upward offset even without the hidden composer.
- Clamped the upward scroll limit to one fully visible newest caption plus exactly half of the previous caption, while allowing the reverse direction to reveal older history.
- Deduplicated consecutive scripted caption starts so development refresh behavior cannot accumulate repeated greeting cards.
- Targeted TypeScript, ESLint, and whitespace validation pass.
