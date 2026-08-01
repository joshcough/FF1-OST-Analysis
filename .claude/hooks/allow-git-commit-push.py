#!/usr/bin/env python3
"""PreToolUse hook: auto-allow git commit/push in this repo only.

Josh's global settings ask before any git commit/push; this project opts
out (his request, 2026-07-31). Only fires when the whole command is git
operations and includes a commit or push — anything else falls through
to the normal permission flow.
"""
import sys, json, re

data = json.load(sys.stdin)
c = data.get("tool_input", {}).get("command", "")
# blank quoted strings first so separators inside commit messages don't
# produce bogus segments (a ";" in a -m body used to break the match)
stripped = re.sub(r'"[^"]*"|\'[^\']*\'', '""', c)
segs = [s for s in re.split(r"&&|;|\|\|", stripped) if s.strip()]
GIT = r"\s*(rtk\s+)?git\s+(-C\s+\S+\s+)?(add|commit|push|status|diff|log|show|fetch|pull|restore|rm|mv)\b"
git_only = bool(segs) and all(re.match(GIT, s) for s in segs)
if git_only and re.search(r"\bgit\s+(-C\s+\S+\s+)?(commit|push)\b", c):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",
        "permissionDecisionReason": "FF1 repo: git commit/push auto-allowed",
    }}))
