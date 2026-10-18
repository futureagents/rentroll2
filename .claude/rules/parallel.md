# Parallel development — lane ownership

Several Claude Code sessions build RentRoll at once, each in its own git worktree on its own branch
("lane"). A lane is named by the spec IDs it owns, e.g. `lane/L-04-rent-board`.

## Ownership
- A lane owns the files it creates for its spec IDs: its route folder(s) under `src/app`, its server
  module(s), its tests, and its spec screen file(s) if a decision requires a spec edit.
- Never casually edit another lane's files, including "small fixes". If another lane's code blocks
  you, write the integration requirement down (what you need, which ID needs it, proposed signature)
  in your PR description under **Integration requirements**, and build against a local stub.
- Shared code has no single lane: `src/components/ui` (A2), `src/lib`, `src/server/supabase`,
  `src/server/env.ts`, `src/app/globals.css`, `scripts/`, `spec/decisions.md`, `CLAUDE.md`, `.claude/`.
  Changes there are their own PR, small, citing the A2 row or D-nn, never bundled into a feature PR.
- A missing shared component is built as the minimum local version inside the lane's folder and
  marked `// PROMOTE: <what it is and which A2 row it should become>`. The promotion is a later,
  separate PR that moves it into `src/components/ui` and deletes the local copies.
- Tokens in `globals.css` are read-only for feature lanes. Need a value that is not an A1 token?
  That is a spec question, not a local override.

## Dependencies
- `package.json` and `package-lock.json` are shared. A lane that truly needs a new dependency
  installs it with `npm install <pkg>` (so the lockfile is regenerated, never hand-edited), commits both
  files in their own commit, and names the package and why under **New dependencies** in its PR.
- Prefer what is already installed. Do not add a UI kit, state library or ORM; the stack is fixed.

## Commits and branches
- Commit work in progress early and often on the lane branch, with spec IDs in the subject. Nothing
  may ever live only as uncommitted files: a worktree can be deleted, and another lane cannot see
  uncommitted work. End every session with a commit, even if the subject is `WIP L-04: …`.
- Rebase onto `main` before opening the PR; resolve conflicts in shared files by taking `main` and
  re-applying your change on top, never by overwriting the other lane's version.
- Never force-push a shared branch. Never commit to `main` directly.
- `npm run verify` must pass before push.

## Environment
- `.env.local` is not in git. Copy it by hand into each new worktree; never print or commit it.
- Each worktree runs its own `npm install`. `node_modules` is never shared or committed.
