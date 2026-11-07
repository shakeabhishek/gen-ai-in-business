"""Stamp CSS and JS links in index.html with a hash of each file's contents.

GitHub Pages lets browsers cache files for 10 minutes, so after an update visitors can
see a new page with an old stylesheet. A changed file gets a new ?v= value, which forces
a fresh download. Run before every publish:

    python3 scripts/stamp_assets.py
"""

import hashlib
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
page = SITE / "index.html"
html = page.read_text()


def stamp(match: re.Match) -> str:
    attr, path = match.group(1), match.group(2)
    digest = hashlib.sha256((SITE / path).read_bytes()).hexdigest()[:10]
    return f'{attr}="{path}?v={digest}"'


new = re.sub(r'(href|src)="(assets/(?:css|js)/[^"?]+)(?:\?v=[0-9a-f]+)?"', stamp, html)
page.write_text(new)
for line in re.findall(r'assets/(?:css|js)/[^"]+', new):
    print(line)
