# Vendored: obra/superpowers

The 14 skill directories beside this file come from
[obra/superpowers](https://github.com/obra/superpowers) **v6.2.0**, MIT licensed
(`SUPERPOWERS-LICENSE`, © 2025 Jesse Vincent). Vendored 9 Aug 26 at upstream
commit `44c9b2d`.

## Why vendored rather than installed

Superpowers is a plugin marketplace, and a plugin install lives in
`~/.claude/plugins` on the machine that ran `/plugin marketplace add`. Claude
Code web sessions get a fresh container with only this repo cloned into it, so a
locally-installed plugin is never present. Repo-level skills ship with the
clone, so they are available in every session — local, web, or scheduled —
without anyone installing anything.

## What changed from upstream

1. **Cross-references de-namespaced.** Upstream skills call each other as
   `superpowers:test-driven-development`; a repo-level skill is invoked by its
   bare name, so the `superpowers:` prefix was stripped from all 26 references.
   No other edits — the skill bodies are upstream's, unmodified.
2. **The SessionStart hook is vendored but NOT wired in.** Upstream ships a hook
   that injects the whole `using-superpowers` skill into every session as
   `<EXTREMELY_IMPORTANT>` context. The adapted script is at
   `.claude/hooks/superpowers-session-start.sh`, with enabling instructions in
   its header. Nothing in `.claude/settings.json` references it.

   Without the hook the skills still work normally — the Skill tool matches them
   on their descriptions. The hook only makes `using-superpowers` unconditional,
   at a cost of about 3KB of context (~800 tokens) on every session start —
   measured at this version by running the script, not estimated.

## Updating

There is no auto-update. Re-clone upstream, copy `skills/` over, and re-apply
change 1:

```sh
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
cp -a /tmp/sp/skills/. .claude/skills/
cd .claude/skills
NAMES=$(ls -d */ | tr -d '/' | paste -sd'|')
grep -rlEZ "superpowers:($NAMES)" . | xargs -0 sed -i -E "s/superpowers:($NAMES)/\1/g"
```

The de-namespacing is idempotent, and `grep -rn 'superpowers:' .` returning
nothing is the check that it took.

Read upstream's release notes before taking a new version: several of these
skills carry deliberately aggressive trigger descriptions (`brainstorming` says
"You MUST use this before any creative work"), so a version bump can change how
often they fire without changing anything you asked for.

## Overlap with what Claude Code already has

Not conflicts, but worth knowing they coexist — where both apply, the built-in
is usually the better-integrated path:

| superpowers skill | already covered by |
|---|---|
| `using-git-worktrees` | the Agent tool's `isolation: "worktree"` |
| `dispatching-parallel-agents` | the Agent tool and the Workflow tool |
| `requesting-code-review` | the `/code-review` and `/security-review` skills |
| `verification-before-completion` | whatever gates this repo defines — once a `CLAUDE.md` names them, **that wins**, because it names real commands |
