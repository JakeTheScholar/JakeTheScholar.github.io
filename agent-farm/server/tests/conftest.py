"""Shared fixtures for Agent Farm metric tests.

Provides in-memory PipelineDB instances with deterministic seed data so every
test can make exact assertions against known values.
"""

import pytest
from datetime import datetime, timedelta
from pipeline_db import PipelineDB, VALID_STAGES


# ── Base dates for deterministic timestamps ──
BASE = datetime(2026, 3, 1, 8, 0, 0)


def _ts(days=0, hours=0):
    """Return ISO timestamp offset from BASE."""
    return (BASE + timedelta(days=days, hours=hours)).isoformat()


# ── Seed helpers (raw SQL for full control over timestamps) ──

def _seed_lead(conn, lead_id, industry, stage, score, source, created_at,
               contact_name=None, needs=None, location=None):
    conn.execute(
        """INSERT INTO leads (id, business_name, industry, contact_name,
           contact_email, website, location, needs, stage, score, source,
           created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lead_id, f"Biz {lead_id}", industry, contact_name or "Owner",
         f"{lead_id}@test.com", f"http://{lead_id}.com", location or "Austin TX",
         needs or '["website redesign"]', stage, score, source,
         created_at, created_at),
    )


def _seed_transition(conn, lead_id, from_stage, to_stage, changed_by, changed_at):
    conn.execute(
        """INSERT INTO pipeline_stages (lead_id, from_stage, to_stage, changed_by,
           changed_at, detail) VALUES (?, ?, ?, ?, ?, ?)""",
        (lead_id, from_stage, to_stage, changed_by, changed_at,
         f"{from_stage or 'new'} -> {to_stage}"),
    )


def _seed_item(conn, item_id, pipeline_type, title, stage, score,
               source_agent, created_at, subtitle=None, metadata=None):
    conn.execute(
        """INSERT INTO pipeline_items (id, pipeline_type, title, subtitle, stage,
           score, metadata, source_agent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (item_id, pipeline_type, title, subtitle, stage, score,
         metadata, source_agent, created_at, created_at),
    )


def _seed_item_transition(conn, item_id, pipeline_type, from_stage, to_stage,
                          changed_by, changed_at):
    conn.execute(
        """INSERT INTO pipeline_transitions (item_id, pipeline_type, from_stage,
           to_stage, changed_by, changed_at, detail)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (item_id, pipeline_type, from_stage, to_stage, changed_by, changed_at,
         f"{from_stage or 'new'} -> {to_stage}"),
    )


def _seed_outreach(conn, lead_id, channel, status, created_at, sent_at=None,
                   subject=None, body="Test outreach body"):
    conn.execute(
        """INSERT INTO outreach_log (lead_id, channel, subject, body, status,
           created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (lead_id, channel, subject or f"Outreach to {lead_id}", body,
         status, created_at, sent_at),
    )


def _seed_campaign(conn, camp_id, name, industry, status, target, generated,
                   created_at):
    conn.execute(
        """INSERT INTO campaigns (id, name, industry, status, target_count,
           leads_generated, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (camp_id, name, industry, status, target, generated, created_at, created_at),
    )


def _build_lead_with_transitions(conn, lead_id, industry, final_stage, score,
                                 source, start_day, hours_between_stages=24):
    """Insert a lead and all transitions up to final_stage with predictable timing."""
    stages = list(VALID_STAGES)
    final_idx = stages.index(final_stage)
    created = _ts(days=start_day)
    _seed_lead(conn, lead_id, industry, final_stage, score, source, created)

    agents = {
        "scraped": "lead-scraper-001",
        "researched": "research-001",
        "pitch_ready": "outreach-001",
        "contacted": "outreach-001",
        "responded": "pipeline-mgr-001",
        "closed": "pipeline-mgr-001",
    }

    # Initial transition (None -> scraped)
    _seed_transition(conn, lead_id, None, "scraped", agents["scraped"], created)

    # Subsequent transitions
    for i in range(1, final_idx + 1):
        t = _ts(days=start_day, hours=hours_between_stages * i)
        _seed_transition(conn, lead_id, stages[i - 1], stages[i], agents[stages[i]], t)


# ── Fixtures ──

@pytest.fixture
def db():
    """Fresh empty in-memory PipelineDB."""
    d = PipelineDB(db_path=":memory:")
    yield d
    d.close()


@pytest.fixture
def seeded_db():
    """In-memory PipelineDB with deterministic seed data.

    Leads layout (18 total, 3 per stage):
      - 3 scraped (days 0-2), scores 25-35, industries: hvac, dental, real_estate
      - 3 researched (days 3-5), scores 40-50, industries: auto_repair, hvac, dental
      - 3 pitch_ready (days 6-8), scores 55-65, industries: real_estate, auto_repair, hvac
      - 3 contacted (days 9-11), scores 60-70, industries: dental, real_estate, auto_repair
      - 3 responded (days 12-14), scores 70-80, industries: hvac, dental, real_estate
      - 3 closed (days 15-17), scores 80-95, industries: auto_repair, hvac, dental

    Transition timing: 24 hours between each stage (predictable).
    Outreach: contacted + responded + closed leads have email outreach.
             responded + closed leads also have DM outreach.
             Some outreach is 'sent', some 'drafted'.
    Items: 12 across etsy(4), fiverr(3), content(3), websites(2).
    Campaigns: 2 (one active, one completed).
    """
    d = PipelineDB(db_path=":memory:")
    conn = d._conn

    industries = ["hvac_plumbing", "dental_ortho", "real_estate", "auto_repair"]
    stage_configs = [
        ("scraped",     [25, 30, 35], [0, 1, 2]),
        ("researched",  [40, 45, 50], [3, 4, 5]),
        ("pitch_ready", [55, 60, 65], [6, 7, 8]),
        ("contacted",   [60, 65, 70], [9, 10, 11]),
        ("responded",   [70, 75, 80], [12, 13, 14]),
        ("closed",      [80, 88, 95], [15, 16, 17]),
    ]

    lead_idx = 0
    all_lead_ids = []
    for stage, scores, start_days in stage_configs:
        for i in range(3):
            lid = f"lead-{lead_idx:03d}"
            industry = industries[(lead_idx) % len(industries)]
            _build_lead_with_transitions(
                conn, lid, industry, stage, scores[i],
                "lead-scraper-001", start_days[i], hours_between_stages=24,
            )
            all_lead_ids.append((lid, stage))
            lead_idx += 1

    # ── Outreach (for contacted / responded / closed leads) ──
    contacted_ids = [lid for lid, st in all_lead_ids if st in ("contacted", "responded", "closed")]
    for i, lid in enumerate(contacted_ids):
        created = _ts(days=10 + i, hours=2)
        sent = _ts(days=10 + i, hours=6) if i % 2 == 0 else None
        status = "sent" if sent else "drafted"
        _seed_outreach(conn, lid, "email", status, created, sent)

    responded_ids = [lid for lid, st in all_lead_ids if st in ("responded", "closed")]
    for i, lid in enumerate(responded_ids):
        created = _ts(days=13 + i, hours=1)
        sent = _ts(days=13 + i, hours=3) if i % 2 == 0 else None
        status = "sent" if sent else "drafted"
        _seed_outreach(conn, lid, "dm", status, created, sent)

    # ── Pipeline items (12 across 4 types) ──
    items_config = [
        # (id, type, title, stage, score, agent, day)
        ("item-e01", "etsy", "Trading Journal A4", "listed", 72, "etsy-lister-001", 1),
        ("item-e02", "etsy", "Budget Planner", "designed", 55, "printables-001", 3),
        ("item-e03", "etsy", "Debt Tracker", "selling", 88, "etsy-lister-001", 5),
        ("item-e04", "etsy", "Investment Log", "drafted", 40, "printables-001", 7),
        ("item-f01", "fiverr", "Landing Page Gig", "active", 65, "fiverr-001", 2),
        ("item-f02", "fiverr", "AI Chatbot Gig", "completed", 82, "fiverr-001", 4),
        ("item-f03", "fiverr", "SEO Audit Gig", "drafted", 35, "fiverr-001", 6),
        ("item-c01", "content", "TikTok AI Hustle", "published", 78, "faceless-content-001", 1),
        ("item-c02", "content", "Trading Bot Demo", "created", 60, "faceless-content-001", 8),
        ("item-c03", "content", "Agent Farm Tour", "performing", 91, "faceless-content-001", 10),
        ("item-w01", "websites", "HVAC Site Mockup", "generated", 70, "web-dev-001", 9),
        ("item-w02", "websites", "Dental Landing Page", "polished", 76, "web-dev-001", 11),
    ]
    for iid, ptype, title, stage, score, agent, day in items_config:
        _seed_item(conn, iid, ptype, title, stage, score, agent, _ts(days=day))
        _seed_item_transition(conn, iid, ptype, None, stage, agent, _ts(days=day))

    # Items with multi-step transitions (for funnel testing)
    # item-e01 went drafted -> designed -> listed
    _seed_item_transition(conn, "item-e01", "etsy", None, "drafted", "printables-001", _ts(days=0))
    _seed_item_transition(conn, "item-e01", "etsy", "drafted", "designed", "printables-001", _ts(days=0, hours=12))
    _seed_item_transition(conn, "item-e01", "etsy", "designed", "listed", "etsy-lister-001", _ts(days=1))

    # item-e03 went drafted -> designed -> listed -> optimized -> selling
    _seed_item_transition(conn, "item-e03", "etsy", None, "drafted", "printables-001", _ts(days=2))
    _seed_item_transition(conn, "item-e03", "etsy", "drafted", "designed", "printables-001", _ts(days=3))
    _seed_item_transition(conn, "item-e03", "etsy", "designed", "listed", "etsy-lister-001", _ts(days=3, hours=12))
    _seed_item_transition(conn, "item-e03", "etsy", "listed", "optimized", "seo-001", _ts(days=4))
    _seed_item_transition(conn, "item-e03", "etsy", "optimized", "selling", "seo-001", _ts(days=5))

    # ── Campaigns (2) ──
    _seed_campaign(conn, "camp-001", "HVAC Spring Push", "hvac_plumbing",
                   "active", 50, 32, _ts(days=0))
    _seed_campaign(conn, "camp-002", "Dental Fall Campaign", "dental_ortho",
                   "completed", 30, 30, _ts(days=-30))

    conn.commit()
    yield d
    d.close()
