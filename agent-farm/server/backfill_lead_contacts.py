"""One-off backfill: re-fetch Google Places details for leads that were
scraped before the details_budget fix and are missing phone/website/maps_url.

For each matching lead:
  1. Find the place via Google Text Search using "business_name + address"
  2. Fetch Place Details (phone, website, maps_url)
  3. Update the lead row with fresh contact info + notes blob
  4. Delete the stale mockup_email outreach row
  5. Force the lead stage back to pitch_ready so outreach agent re-drafts
     with the actual phone / maps URL visible.

Run from agent-farm/server/ with: python backfill_lead_contacts.py
"""

import os
import re
import sys
import json
import sqlite3
import asyncio
import logging
from datetime import datetime
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent))

# Load server/.env so GOOGLE_MAPS_API_KEY is available when running standalone
_env = Path(__file__).parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

GOOGLE_PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
SOCIAL_DOMAINS = (
    "facebook.com", "instagram.com", "tiktok.com", "yelp.com",
    "twitter.com", "x.com", "linkedin.com", "nextdoor.com", "youtube.com",
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("backfill")


def _is_social(url: str | None) -> bool:
    if not url:
        return False
    u = url.lower()
    return any(s in u for s in SOCIAL_DOMAINS)


async def _find_place_id(client: httpx.AsyncClient, api_key: str, name: str, address: str) -> str | None:
    params = {"query": f"{name} {address}", "key": api_key}
    resp = await client.get(GOOGLE_PLACES_TEXT_SEARCH_URL, params=params)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        log.warning(f"  text search status: {data.get('status')} — {data.get('error_message', '')}")
        return None
    results = data.get("results", [])
    return results[0].get("place_id") if results else None


async def _place_details(client: httpx.AsyncClient, api_key: str, place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,website,url",
        "key": api_key,
    }
    resp = await client.get(GOOGLE_PLACES_DETAILS_URL, params=params)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "OK":
        return {}
    return data.get("result", {})


async def backfill(dry_run: bool = False) -> None:
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        log.error("GOOGLE_MAPS_API_KEY not set — cannot backfill")
        return

    db_path = Path(__file__).parent / "data" / "pipeline.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # Two cohorts need backfill:
    #   1. Leads that already got a "no contact found" mockup_email drafted
    #   2. Leads queued at pitch_ready that still have no phone/notes — they'd
    #      get the same broken draft on the next outreach tick if we don't fix.
    cur = conn.execute("""
        SELECT DISTINCT l.id, l.business_name, l.location, l.contact_phone,
               l.website, l.contact_email, l.notes, l.stage
        FROM leads l
        LEFT JOIN outreach_log o ON o.lead_id = l.id AND o.channel = 'mockup_email'
        WHERE (l.contact_phone IS NULL OR l.contact_phone = '')
          AND (l.notes IS NULL OR l.notes = '')
          AND (o.id IS NOT NULL OR l.stage = 'pitch_ready')
    """)
    targets = [dict(r) for r in cur.fetchall()]

    log.info(f"Found {len(targets)} leads needing backfill")
    if not targets:
        return

    updated = 0
    async with httpx.AsyncClient(timeout=15) as client:
        for lead in targets:
            biz = lead["business_name"]
            addr = lead["location"] or ""
            log.info(f"-> {biz} ({addr})")
            try:
                place_id = await _find_place_id(client, api_key, biz, addr)
                if not place_id:
                    log.info("   no place_id — skipping")
                    continue
                details = await _place_details(client, api_key, place_id)
                phone = details.get("formatted_phone_number")
                website = details.get("website")
                maps_url = details.get("url")

                social_url = None
                if _is_social(website):
                    social_url = website
                    website = None

                notes_data = {}
                if maps_url:
                    notes_data["maps_url"] = maps_url
                if social_url:
                    notes_data["social_url"] = social_url
                notes_json = json.dumps(notes_data) if notes_data else None

                log.info(f"   phone={phone!r} website={website!r} maps={bool(maps_url)}")

                if not phone and not maps_url and not social_url and not website:
                    log.info("   Google returned no useful contact info either — skipping")
                    continue

                if dry_run:
                    continue

                now = datetime.now().isoformat()
                with conn:
                    conn.execute(
                        """UPDATE leads
                           SET contact_phone = COALESCE(?, contact_phone),
                               website       = COALESCE(?, website),
                               notes         = ?,
                               updated_at    = ?
                         WHERE id = ?""",
                        (phone, website, notes_json, now, lead["id"]),
                    )
                    # Drop the stale mockup_email row so outreach re-drafts
                    conn.execute(
                        "DELETE FROM outreach_log WHERE lead_id = ? AND channel = 'mockup_email'",
                        (lead["id"],),
                    )
                    # Force stage back to pitch_ready (bypassing forward-only rule)
                    old_stage = lead["stage"]
                    if old_stage != "pitch_ready":
                        conn.execute(
                            "UPDATE leads SET stage = 'pitch_ready', updated_at = ? WHERE id = ?",
                            (now, lead["id"]),
                        )
                        conn.execute(
                            """INSERT INTO pipeline_stages
                               (lead_id, from_stage, to_stage, changed_by, changed_at, detail)
                               VALUES (?, ?, 'pitch_ready', 'backfill-script', ?, ?)""",
                            (lead["id"], old_stage, now, "Backfilled Google Places details"),
                        )
                updated += 1

            except Exception as e:
                log.warning(f"   failed: {e}")

    log.info(f"Backfill complete: updated {updated}/{len(targets)} leads")


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    asyncio.run(backfill(dry_run=dry))
