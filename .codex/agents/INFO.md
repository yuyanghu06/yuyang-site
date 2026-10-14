# Project agent roles

This folder defines reusable Codex specialists and an optional coordinating role. Supporting local Codex clients discover the standalone `.toml` files here. Each file provides `name`, `description`, and `developer_instructions`, following the [official sub-agent configuration documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The primary agent's default orchestrator behavior comes from the repository's `AGENTS.md`; the orchestrator role file does not replace the primary agent automatically. When the current runtime cannot select named roles, the orchestrator reads the relevant TOML and supplies its `developer_instructions` in the spawned agent's task brief. Files alone do not prove that a running session has loaded named roles.

Use a separate planner, scoped coder workers, and an independent evaluator for project work. Multiple workers can use the same coder definition. Specialists do not recursively start the pipeline. Respect actual runtime capacity and give every writable file one owner at a time. These role files do not override model, reasoning effort, or permissions.

## Direct subfolders

There are no direct subfolders.

## Direct files

- `INFO.md` explains discovery, runtime fallback, and the role inventory.
- `planner.toml` defines read-only investigation, acceptance criteria, work decomposition, and verification planning.
- `coder.toml` defines scoped implementation, local documentation maintenance, targeted checks, and corrections.
- `evaluator.toml` defines independent inspection and verification, evidence-backed findings, and review of corrections.
- `orchestrator.toml` defines reusable coordination, integration, shared documentation ownership, and specialist handoffs.
