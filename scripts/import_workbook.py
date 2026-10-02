"""Import the 2 October 2026 research workbook into seed JSON.

Usage: pip install openpyxl && python scripts/import_workbook.py [path-to-xlsx]

Reads cached values (the workbook's formulas were computed by Excel), so the
QC score and rank match what the sheet shows. Writes:
  data/seed/lab-reports.json  one row per published report or rating (All reports)
  data/seed/listings.json     quick-commerce listing evidence (QC listings)
  data/seed/qc-lines.json     the 39 shortlisted QC product lines (Shortlist)
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/source/QC_lab_report_products_2026-10-02.xlsx"
OUT = ROOT / "data/seed"


def clean(v):
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, str):
        v = v.strip()
        return v if v and v not in ("–", "-") else None
    return v


def rows(ws, header_row):
    headers = [c.value for c in ws[header_row]]
    for r in ws.iter_rows(min_row=header_row + 1):
        values = [clean(c.value) for c in r]
        if not any(values):
            continue
        yield dict(zip(headers, values)), r


def flag(v):
    # Platform flags: Y = listing seen, ? = only third-party/cached page, – = not seen
    if v == "Y":
        return "seen"
    if v == "?":
        return "unconfirmed"
    return None


wb = openpyxl.load_workbook(SRC, data_only=True)

reports = []
for d, _ in rows(wb["All reports"], 4):
    if not d.get("ID"):
        continue
    reports.append({
        "id": d["ID"],
        "brand": d["Brand"],
        "product": d["Product"],
        "segment": d["Segment"],
        "category": d["Category"],
        "verdict": d["Verdict"],
        "reportDate": d["Report date"],
        "batch": d["Batch tested"],
        "lab": d["Lab"],
        "source": d["Source"],
        "externalRating": d["Unbox rating"],
        "url": d["Report link"],
        "qcKey": d["QC key"],
        "qcMatch": d["QC match"],
        "platforms": {p: flag(d[p]) for p in ("Blinkit", "Zepto", "Instamart", "BigBasket")},
        "access": d["Access"],
        "publishRoute": d["Publish route"],
        "notes": d["Notes"],
    })

listings = []
for d, _ in rows(wb["QC listings"], 4):
    if not d.get("QC key"):
        continue
    listings.append({
        "qcKey": d["QC key"],
        "line": d["Product line"],
        "platform": d["Platform"],
        "seen": d["Listing, pack and price seen"],
        "ratingsCount": d["Ratings count"] if isinstance(d["Ratings count"], (int, float)) else None,
        "evidence": d["Evidence"],
        "capturedAt": d["Seen on"],
        "url": d["Listing URL"],
        "notes": d["Notes"],
    })

lines = []
by_row = {i + 5: r for i, r in enumerate(reports)}  # All reports data starts on sheet row 5
for d, _ in rows(wb["Shortlist"], 4):
    if not isinstance(d.get("QC rank"), (int, float)):
        continue
    helper = d["Helper: row in All reports"]
    rep = reports[int(helper) - 1] if helper else None
    lines.append({
        "rank": int(d["QC rank"]),
        "reportId": rep["id"] if rep else None,
        "qcKey": rep["qcKey"] if rep else None,
        "brand": d["Brand"],
        "product": d["Product (as listed by the report source)"],
        "category": d["Category"],
        "verdict": d["Verdict"],
        "platforms": d["Platforms with a listing"],
        "topRatingsCount": d["Top ratings count"],
        "demandTier": d["Demand tier (0-3)"],
        "qcScore": d["QC score"],
        "qcMatch": d["QC match"],
        "publishRoute": d["Publish route"],
    })

OUT.mkdir(parents=True, exist_ok=True)
for name, data in (("lab-reports", reports), ("listings", listings), ("qc-lines", lines)):
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    print(f"{name}: {len(data)} rows")
