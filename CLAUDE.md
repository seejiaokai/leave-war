# Working agreements for this repo

## Merge into `main` at the end of every change

**Owner's standing request, 10 Aug 26.** Every change they ask for ends merged
into `main` and pushed. They do not want to ask for it each time, and they do
not want to review a pull request to get it.

The reason it was asked for: two branches ran in parallel on 10 Aug because
`main` sat untouched for a day while the real work lived on a branch nobody
could see from `main`'s own `docs/RESUME.md`. A session read that file, took
its word that `main` was the only branch, and rebuilt an entire completed plan
from scratch. **Work that is not on `main` is work the next session cannot
find.** Merging is what stops that happening twice.

The gate, which is not optional and is the whole reason this is safe:

- `npx vitest run`, `npm run build` and `npm run test:e2e` have all been **run**
  and are green, with their real output reported
- the working tree is clean and the feature branch is pushed

**Never merge red.** If any of the three fails, say so, leave `main` alone, and
fix it first — a merge is the reward for a green gate, not a step that happens
regardless. If a merge would not fast-forward, do the merge, re-run the gate on
the result, and only then push.

Keep working on the feature branch afterwards; `main` moving does not end it.

## Notify when the turn is genuinely finished

**Owner's standing request, 10 Aug 26.** When a turn's work is complete — all
tasks done *and* all checks run — send a push notification with the
`PushNotification` tool so the owner knows it is their turn to reply. They
step away while work is running and should not have to poll the session.

"Complete" means finished, not paused:

- every task in the list is done, not merely the current one
- `npx vitest run`, `npm run build` and `npm run test:e2e` have been **run**,
  with their real results reported — a claim of green without the output is
  not a check
- anything committed is also pushed

Send it when you are **blocked and waiting on them** too — a question that
stops the work is exactly as worth interrupting for as finishing it.

Do **not** send one for routine progress mid-turn, or when they are plainly
sitting there watching. The tool suppresses a notification that would only
duplicate output already reaching them, so a "not sent" result is normal and
needs no comment or retry.

Keep the message one line, under 200 characters, leading with what they would
act on: `leave-war: 405 tests + 56 browser runs green, pushed` beats
`task complete`.

## Read before proposing anything

`docs/RESUME.md` is the entry point — where the work stopped and what comes
next. `docs/known-gaps.md` holds the limitations and rulings already settled;
reading it is what stops a session relitigating a decision the owner has
already made.

## How defects actually get found here

Every real defect in this project has come from a review or a measurement,
never from the suite going red. After writing a test, mutate the
implementation to reintroduce the bug that test guards and confirm that test —
and only that one — fails. **A test not yet seen red is unproven.** That
discipline has caught four tests that could not fail, and the browser gate has
caught three defects that every unit test passed straight through.
