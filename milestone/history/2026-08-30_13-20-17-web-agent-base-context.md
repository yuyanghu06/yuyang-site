# Web agent base context

Added a compact authoritative personal-facts block to the portfolio guide's base system prompt. It covers Yuyang's San Diego hometown, height, favorite country song, completed BAC ML Director tenure, and Sally Hu's corrected name.

The prompt now requires natural, question-relevant use of those facts, prohibits presenting them as a Quick Facts section or list, and prohibits inferring or stating Yuyang's current residential base.

Updated `src/agent/INFO.md` to document ownership of these base facts and constraints. Targeted ESLint validation passed for `src/agent/run-agent.ts`.
