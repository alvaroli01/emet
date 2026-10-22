#!/usr/bin/env python3
"""
Refresh the emet Obsidian vault (obsidian/emet/) from the repo, so the vault always carries what GitHub has:
  - 04 History/Changelog.md      ← CHANGELOG.md (whole file)
  - 04 History/Decisions log.md  ← README.md section 9 (dates link to their day note when one exists)
  - 05 Resources/Repo README.md  ← README.md (whole file, read-only copy)
  - 05 Resources/Specs and plans.md ← list of docs/superpowers/specs + plans with GitHub links
Notes written by hand (systems, days, team…) are never touched. Run from anywhere:  python3 obsidian/sync-from-repo.py
"""
import datetime, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
VAULT = ROOT / "obsidian" / "emet"
GH = "https://github.com/alvaroli01/emet/blob/main/"
today = datetime.date.today().isoformat()


def front(tags: str) -> str:
    return f"---\ntags: [{tags}]\nupdated: {today}\n---\n\n"


def write(rel: str, text: str) -> None:
    p = VAULT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    print("wrote", rel)


readme = (ROOT / "README.md").read_text(encoding="utf-8")
changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")

# 1. Changelog — the whole repo file
body = re.sub(r"^# Changelog\s*\n", "", changelog, count=1)
write("04 History/Changelog.md", front("emet, history") + f"# Changelog (synced from the repo's CHANGELOG.md, {today})\n\n" + body.strip() + "\n\nBack to [[Timeline]]\n")

# 2. Decisions log — README section 9, newest first, day notes linked
sec = re.search(r"## 9\. Decisions log\s*\n(.*?)\n## ", readme, re.S)
rows = [l for l in (sec.group(1) if sec else "").splitlines() if re.match(r"\|\s*\d{4}-\d{2}-\d{2}", l)]
days = {p.stem for p in (VAULT / "04 History" / "Days").glob("*.md")}
out = []
for l in sorted(rows, key=lambda r: r.split("|")[1].strip(), reverse=True):
    cells = [c.strip() for c in l.strip().strip("|").split("|")]
    date, decision, who = cells[0], cells[1], (cells[2] if len(cells) > 2 else "")
    d = f"[[{date}]]" if date in days else date
    out.append(f"| {d} | {decision} | {who} |")
write("04 History/Decisions log.md", front("emet, decisions") + f"# Decisions log (synced from README §9, {today})\n\n| Date | Decision | Decided by |\n|---|---|---|\n" + "\n".join(out) + "\n\nBack to [[Timeline]]\n")

# 3. Full README copy
write("05 Resources/Repo README.md", front("emet, resource, repo") + f"> Read-only copy of the repo's README.md (synced {today}). The repo is the source of truth: [README on GitHub]({GH}README.md)\n\n" + readme)

# 4. Specs and plans index
lines = []
for kind in ("specs", "plans"):
    files = sorted((ROOT / "docs" / "superpowers" / kind).glob("*.md"), reverse=True)
    lines.append(f"## {kind.capitalize()}\n")
    lines += [f"- [{f.stem}]({GH}docs/superpowers/{kind}/{f.name})" for f in files]
    lines.append("")
write("05 Resources/Specs and plans.md", front("emet, resource") + f"# Specs and plans (synced {today})\n\nDesign specs and build plans for each feature, newest first.\n\n" + "\n".join(lines) + "\nBack to [[Repo map]]\n")
