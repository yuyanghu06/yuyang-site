# Codex project configuration

This folder contains repository-scoped Codex configuration, agent role definitions, and reusable skills.

`AGENTS.md` at the repository root makes the primary agent the orchestrator. Supporting local clients discover roles in `agents/`; runtimes without named-role selection use the task-brief fallback documented there. Configuration follows the [official sub-agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents). A running session's available tools and concurrency limits remain authoritative.

## Direct subfolders

- `agents/` contains planner, coder, evaluator, and reusable orchestrator definitions, plus documentation of role loading and the fallback for other runtimes.
- `skills/` contains custom skills maintained with this repository.

## Direct files

- `INFO.md` documents this folder and the configuration entry points.
- `config.toml` enables agents and permits three concurrent sub-agent threads per session in supporting clients, excluding the primary agent. It does not override models, reasoning effort, or permissions.
