#!/usr/bin/env python3
"""Pull public reviews off the Gumroad product pages and write reviews/gumroad.json.

Gumroad renders each product page with Inertia, so the numeric product id we need
lives in the page's data-page blob. Once we have that id, /product_reviews is a
plain public JSON endpoint - no auth, no key.

Run it from anywhere; paths are resolved relative to the repo root.
"""

import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reviews" / "gumroad.json"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
STORE = "https://immanentaudio.gumroad.com"

# Gumroad slug -> which product page on the site the review belongs to.
# "product" matches the data-reviews-product attribute in the page markup.
PRODUCTS = [
    {"slug": "ozydcb", "product": "spectral-agent", "name": "Spectral Agent 2"},
    {"slug": "bejaxg", "product": "spectral-agent", "name": "Spectral Agent"},
    {"slug": "mlqfwn", "product": "vibrancy", "name": "Vibrancy"},
    {"slug": "hjuqeo", "product": "de-esser", "name": "IA De-Esser"},
    {"slug": "vuncqe", "product": "harmonic-saturator", "name": "Harmonic Saturator"},
]


def get(url, as_json=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json" if as_json else "text/html",
        "X-Requested-With": "XMLHttpRequest",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
    return json.loads(body) if as_json else body


def product_meta(slug):
    """Pull the external product id and the rating totals off the product page.

    The totals matter: most Gumroad ratings are stars with no written message,
    so the review list alone badly undercounts them.
    """
    page = get(f"{STORE}/l/{slug}")
    m = re.search(r'data-page="([^"]*)"', page)
    if not m:
        raise RuntimeError(f"no Inertia payload on /l/{slug}")
    product = json.loads(html.unescape(m.group(1)))["props"]["product"]
    return product["id"], (product.get("ratings") or {})


def reviews_for(pid):
    out, page = [], 1
    while True:
        url = (f"{STORE}/product_reviews?"
               f"product_id={urllib.parse.quote(pid, safe='')}&page={page}")
        data = get(url, as_json=True)
        out.extend(data.get("reviews", []))
        pages = data.get("pagination", {}).get("pages", 1)
        if page >= pages:
            return out
        page += 1


def main():
    hidden = set()
    hide_file = ROOT / "reviews" / "hidden.txt"
    if hide_file.exists():
        for line in hide_file.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if line:
                hidden.add(line)

    collected, failures = [], []
    totals = {}

    for entry in PRODUCTS:
        slug = entry["slug"]
        try:
            pid, ratings = product_meta(slug)
            raw = reviews_for(pid)
        except (urllib.error.URLError, urllib.error.HTTPError,
                RuntimeError, KeyError, ValueError) as exc:
            # One dead product shouldn't throw away everyone else's reviews.
            failures.append(f"{slug}: {exc}")
            continue

        # Several Gumroad listings can map to one page (V1 + V2), so accumulate.
        count = ratings.get("count") or 0
        if count:
            t = totals.setdefault(entry["product"], {"count": 0, "sum": 0.0})
            t["count"] += count
            t["sum"] += (ratings.get("average") or 0) * count

        for r in raw:
            if r["id"] in hidden:
                continue
            message = (r.get("message") or "").strip()
            if not message:
                continue  # star-only rating, nothing to show
            response = (r.get("response") or {}).get("message")
            # Deliberately no reviewer name: people leave these on Gumroad, not
            # here, and nobody should find their name republished on the site.
            collected.append({
                "id": r["id"],
                "source": "gumroad",
                "product": entry["product"],
                "product_name": entry["name"],
                "rating": r.get("rating"),
                "message": message,
                "response": (response or "").strip() or None,
                "date": r.get("created_at"),
            })

    if failures and not collected:
        print("every product failed:\n  " + "\n  ".join(failures), file=sys.stderr)
        return 1
    for f in failures:
        print(f"warning: {f}", file=sys.stderr)

    collected.sort(key=lambda r: r["date"] or "", reverse=True)

    ratings = {
        page: {"count": t["count"], "average": round(t["sum"] / t["count"], 1)}
        for page, t in totals.items() if t["count"]
    }

    payload = {"ratings": ratings, "reviews": collected}

    # Only rewrite when something real changed. The timestamp alone would churn
    # a commit out of the daily workflow every single day.
    if OUT.exists():
        try:
            current = json.loads(OUT.read_text(encoding="utf-8"))
            if {k: current.get(k) for k in payload} == payload:
                print(f"no change ({len(collected)} reviews)")
                return 0
        except ValueError:
            pass  # unreadable file, just overwrite it

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        **payload,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"wrote {len(collected)} reviews to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
