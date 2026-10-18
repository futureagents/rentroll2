---
description: Show the spec for a stable RentRoll ID (L-04, T-01, S-01, P-01, A2, E4, G-2, D-26) — file, route, rules, element IDs, decisions that cite it, and open questions. Read-only.
argument-hint: <ID>
allowed-tools: Read, Grep, Glob
---

Look up the RentRoll spec for `$ARGUMENTS` and report it. Do not implement anything and do not edit
any file.

## Resolve the ID to its file
- `L-nn`, `T-nn`, `S-nn`, `P-nn` → `spec/screens/<ID>.md` (zero-padded, e.g. `L-04`)
- `A1`…`A4` → `spec/foundations.md`, the matching section
- `G-1`, `G-2`, `E1`…`E5`, `E4-n`, `E1-nn`, `E2-nn` → `spec/cross-cutting.md`, the matching section/row
- `D-nn` → `spec/decisions.md`, that decision
- element IDs like `L04-BTN-REMIND` → the screen file of their prefix (`L-04`), the matching row
- `M-n`, `PR-n`, `C-n`, `SM-n` → `spec/product.md`
If the ID is not found, say so and list the nearest IDs from `spec/index.md`. Never guess content.

## Gather
1. Read the resolved file (or section) in full.
2. `grep -n "<ID>" spec/decisions.md` — every decision that cites the ID. Read each cited decision's
   **Decision** and **Consequences** paragraphs.
3. `grep -n "<ID>" spec/screens/*.md spec/foundations.md spec/cross-cutting.md spec/index.md` — other
   files that reference it (shared components it opens, screens that open it, build-tracker phase).
4. Collect every `> OPEN:` line in the resolved file. For each, check whether a D-nn's Consequences
   paragraph resolves it or §9 of decisions.md lists it as intentionally remaining.
5. If `src/` contains code for the ID (grep for the ID in comments, route folders matching the
   route), note the files; do not review them.

## Report, in this order, briefly
- **ID · Name · File** and the route(s) (apply D-03 / D-39 routes if the file says "not stated").
- **Purpose** — the one-line purpose from `spec/index.md`.
- **Rules that bind this screen** — G-1/G-2 where relevant, the file's own Rules section, and
  each D-nn that changes its behaviour, one line each with the decision number.
- **Element IDs** — a compact list of the file's IDs (buttons, fields, sections, messages).
- **Depends on / opened by** — other IDs, with build-tracker phase.
- **OPEN items** — each one marked `resolved by D-nn`, `intentionally open (§9)`, or `UNRESOLVED`.
  Unresolved items must not be decided during implementation; they go back to the user.
- **Code so far** — files found in step 5, if any.
Quote spec wording where it matters; do not paraphrase rules.
