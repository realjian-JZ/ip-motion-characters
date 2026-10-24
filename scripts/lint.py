"""Check the hard motion rules on every character × motion without rendering anything.

    python scripts/lint.py          # exit code 1 if any error

Rules (engine/lint.js): no linear easing, loops start where they end, raised arms ≤ armMax,
one-shots end in idle's starting pose, every key finite and inside the clip, every mouth/hand swap exists.
"""
import asyncio
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import open_page  # noqa: E402


async def main():
    sys.stdout.reconfigure(encoding="utf-8")
    async with open_page() as cdp:
        issues = await cdp.js("IPM.lint()")
    by = defaultdict(list)
    for i in issues:
        by[(i["sev"], i["rule"])].append(i)
    for (sev, rule), items in sorted(by.items()):
        print(f"{sev.upper():5s} {rule}  ({len(items)})")
        for i in items[:12]:
            print(f"      {i['char']:8s} {i['motion']:14s} {i['detail']}")
        if len(items) > 12:
            print(f"      … {len(items) - 12} more")
    errors = sum(1 for i in issues if i["sev"] == "error")
    warns = len(issues) - errors
    print(f"\n{errors} error(s), {warns} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    asyncio.run(main())
