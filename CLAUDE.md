# Working agreements for this repo

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
