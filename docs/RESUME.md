# Start here

LEAVE WAR is a leave-bidding system for a fighter squadron, replacing a
spreadsheet the squadron uses to bid for leave a quarter ahead. This file says
where the work stopped and what comes next, so a session picking it up cold does
not have to reconstruct it from `git log`.

**State as of 9 Aug 26.** 130 unit tests, 16 Playwright tests, clean build, all
verified first-hand. `main` is the only branch and the default. Working tree
clean.

## What exists

The roster, the matrix, and a rules engine that turns days amber and red as
manning thins. Availability is fractional — a half day removes 0.5 of a person,
which is the central thing the spreadsheet could not do. Raptor's dark visual
language throughout.

What it **cannot** do yet is the thing it exists for: nobody can bid, and nobody
can approve. That is the next phase.

## What to read, in order

| File | Why |
|---|---|
| `docs/superpowers/specs/2026-08-09-leave-war-design.md` | The approved design. Start here — it explains the domain, not just the code |
| `docs/known-gaps.md` | Limitations and rulings already made. **Read before proposing anything**, or you will relitigate a settled decision |
| `docs/superpowers/plans/2026-08-09-leave-war-bidding.md` | The next nine tasks, with code and tests written out. **Its header lists five places it is stale** — the code model changed after it was written |

## Next: bidding, stages and approval

The nine tasks in the bidding plan. Then leave balances, then the Raptor
contract document. The design for all three is in the spec.

Two decisions that shape the work and are already made:

- **A pending bid counts as away.** The manning counts show the worst case —
  what happens if everything asked for is granted — because that is what warns a
  scheduler while there is still time to act.
- **A refused bid removes nobody.** He asked, he was told no, he is at work. A
  refusal visibly pulls a day back from red, which is what lets management see
  the effect of a decision as they make it.

## How this project has actually found its defects

Worth knowing, because it is not the obvious way.

A subagent per task, a separate reviewer reading only that task's diff, then a
fix round that must **prove the new test fails against the specific bug it
guards** before the fix is accepted.

Every real defect found here came from the review step. None came from the suite
going red. Among them: a member who had not yet arrived being labelled *posted
out*; count rows matching figures to their labels by array position, so a
per-day rule override would have shown one rule's number under another's name;
and a sticky-header test that could not scroll, and therefore passed against a
header with `position: sticky` removed entirely.

The recurring failure class is **tests that cannot fail**. Treat a new test as
unproven until it has been seen red.

## Two things not to relitigate

Both are in `docs/known-gaps.md` with the reasoning:

- **Approval is unguarded** — there is no login, so anyone can approve any bid,
  and "me" is a fixed roster entry. This follows from deferring accounts to the
  backend. Do not present it as a security model.
- **Nothing reaches Raptor yet.** Raptor needs five new leave types and a portion
  field before it can receive most of what this app produces. The owner intends
  to make that change; the contract it should be built against is the next
  planned document.

## Running it

```
npm install
npm run dev                 # or: npm run build && npx vite preview --port 4173
npx vitest run              # 130 tests
npm run test:e2e            # 16, phone and desktop
npm run build               # typecheck + production build
```

The browser gate is not optional decoration. jsdom applies no layout and reports
every rectangle as 0×0, so the unit suite can prove which class was emitted and
nothing about what was painted. The frozen callsign column and sticky header are
only ever verified there.
