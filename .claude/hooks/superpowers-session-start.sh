#!/usr/bin/env bash
# SessionStart hook — injects the `using-superpowers` skill at session start.
#
# Adapted from obra/superpowers v6.2.0 (MIT). The upstream version locates the
# skill through ${CLAUDE_PLUGIN_ROOT}, which only exists when superpowers is
# installed as a plugin; the skills are vendored into this repo instead, so this
# resolves the path relative to itself and emits only the Claude Code hook
# format (upstream also branches for Cursor and Copilot CLI).
#
# NOT WIRED IN BY DEFAULT. To enable, add to .claude/settings.json:
#
#   { "hooks": { "SessionStart": [ { "matcher": "startup|clear|compact",
#       "hooks": [ { "type": "command", "shell": "bash", "async": false,
#         "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/superpowers-session-start.sh\"" } ] } ] } }
#
# Without it the skills still work — the Skill tool matches them on their
# descriptions like any other skill. The hook only makes `using-superpowers`
# unconditional, at a cost of about 3KB (~800 tokens) on every session start.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_FILE="${SCRIPT_DIR}/../skills/using-superpowers/SKILL.md"

using_superpowers_content=$(cat "${SKILL_FILE}" 2>&1 || echo "Error reading using-superpowers skill")

# Escape for JSON embedding. Each ${s//old/new} is one C-level pass, which is
# why this replaces the obvious character-by-character loop.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_superpowers_escaped=$(escape_for_json "$using_superpowers_content")
session_context="<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**\n\n${using_superpowers_escaped}\n</EXTREMELY_IMPORTANT>"

# printf rather than a heredoc: bash 5.3+ hangs on the heredoc form.
# See https://github.com/obra/superpowers/issues/571
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$session_context"

exit 0
