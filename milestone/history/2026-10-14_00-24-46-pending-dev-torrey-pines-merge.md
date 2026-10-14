# Pending development-branch merge

- Acting role: primary agent; direct work per user request, without delegation.
- Request: start merging new dev into main dev and explain other conflicts in readable English; user will choose overrides.
- Starting state: clean `dev` at `79e2caf`, five commits ahead of `origin/dev`; new dev is `origin/codex/dev-torrey-pines-refinements` at `7f71eed`, including the San Diego expansion.
- Work: ran `git merge --no-commit --no-ff origin/codex/dev-torrey-pines-refinements`; inspected every non-documentation conflict block and the changed-file list.
- Result: merge in progress with 28 unresolved paths (17 documentation, 11 code/configuration/dialogue). No resolutions applied, commit, push, build, or runtime verification performed. Incomplete source contains conflict markers.
- User decisions already provided: keep main dev's San Diego globe text label/leader line and its entire Torrey Highlands view.
- Remaining choices: combine or order district and four-landmark tours, preserve/replace completion copy, and integrate controls, loading/population, shadows, and ambience consistently. Build-command and documentation conflicts can be reconciled by retaining both features and histories.
- Preservation: prior main milestone edits remain in the named stash `preserve main milestone edits before dev merge preparation`; no stash applied or dropped.
- Documentation: this handoff, `milestone/current.md`, `milestone/info.md`, and `milestone/history/info.md` record the unresolved state without removing conflict markers.
- Next: receive conflict decisions, integrate changes, update folder documentation, run targeted checks and the full build before committing.
