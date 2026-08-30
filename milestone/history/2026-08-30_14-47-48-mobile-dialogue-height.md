# Mobile dialogue height repair

- Forced long streamed assistant captions into a guaranteed multiline card height.
- Synchronized the current card height to its measured scroll height while text streams.
- Removed transform arrival compositing and paint containment from assistant cards.
- Bounded short-landscape chat between the inset modal's top and bottom edges.
- Set the expanded mobile dialogue's left inset to 1.25 rem.
- Targeted ESLint and whitespace checks pass.
