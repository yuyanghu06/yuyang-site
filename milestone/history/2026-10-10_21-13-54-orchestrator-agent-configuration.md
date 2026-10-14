# Orchestrator and specialist agent configuration

The user requested an orchestrator-led workflow and configuration files for individual agents. AGENTS.md now directs the primary agent to delegate planning, scoped implementation, and independent evaluation, then integrate results and route findings through a fix/review loop. Existing project requirements are preserved.

Added project-local subagent settings and reusable orchestrator, planner, coder, and evaluator TOML definitions. Coding workers can share the same role with different file assignments. Models and permissions inherit from the active session; capacity follows the host limits. Custom-role support varies by host, so role instructions can also be passed in delegation briefs.

Validation: TOML parsing, role/file consistency, whitespace checks, and independent evaluation. No application code changed; no production build or commit requested. Next: apply this workflow to the next project task.
