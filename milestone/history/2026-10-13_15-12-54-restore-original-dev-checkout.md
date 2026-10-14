# Restore the original project folder on dev

- Role: primary agent; direct workspace migration.
- Request: use the original `backend` project folder on `dev`, rather than a separate `backend-dev` worktree. Migration waited until the user confirmed the other agent had finished.
- Starting state: original `backend` clean on `main` at `474a2e1`; separate `backend-dev` on `dev` at `317a243` with 58 modified/untracked files, completed school populations, four landmarks, and GPT-6 Luna.
- Work: saved a private recovery archive and SHA256 inventory; stopped the retired preview; temporarily stashed working changes and untracked files; detached the old checkout; switched the original checkout to `dev`; reapplied the exact stash; verified all 58 files byte-for-byte; copied non-conflicting ignored source assets; retired the worktree registration and moved the residual directory outside the project; restarted the preview from the original folder. No application changes, branch merge, commit, push, or deployment.
- Evidence: branch `dev`, sole registered worktree `/Users/yuyang/Documents/YuyangSite/backend`; full TypeScript, whitespace validation, homepage HTTP 200, four-landmark manifest HTTP 200, and matching generated-model hash pass. Environment files matched exactly; credentials were not printed. Root/milestone guides now identify the correct active folder.
- Recovery: `/tmp/yuyang-worktree-transfer-20261013-150348` holds transferred files, ignored data/environment recovery, and the retired directory. The temporary transfer stash is dropped after verification.
- Result: the user can continue editing the original project folder; all completed work remains uncommitted on `dev`. Existing feature follow-ups remain unchanged.
