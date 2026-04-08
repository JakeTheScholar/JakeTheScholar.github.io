"""SQLite database layer for multi-pipeline tracking."""

import sqlite3
import uuid
import json
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional


# ─── Pipeline Type Configs ───

PIPELINE_CONFIGS = {
    "leadgen": {
        "label": "Lead Gen",
        "color": "#06b6d4",
        "stages": ("scraped", "researched", "pitch_ready", "contacted", "responded", "closed"),
        "stage_labels": {
            "scraped": "Leads Scraped", "researched": "Research Done",
            "pitch_ready": "Pitch Ready", "contacted": "Contacted",
            "responded": "Responded", "closed": "Closed",
        },
        "transitions": {
            "scraped": ("researched",), "researched": ("pitch_ready",),
            "pitch_ready": ("contacted",), "contacted": ("responded",),
            "responded": ("closed",),
        },
    },
    "etsy": {
        "label": "Etsy Products",
        "color": "#f59e0b",
        "stages": ("drafted", "designed", "listed", "optimized", "selling"),
        "stage_labels": {
            "drafted": "Drafted", "designed": "Designed",
            "listed": "Listed", "optimized": "Optimized",
            "selling": "Selling",
        },
        "transitions": {
            "drafted": ("designed",), "designed": ("listed",),
            "listed": ("optimized",), "optimized": ("selling",),
        },
    },
    "fiverr": {
        "label": "Fiverr Gigs",
        "color": "#8b5cf6",
        "stages": ("drafted", "published", "active", "delivering", "completed"),
        "stage_labels": {
            "drafted": "Drafted", "published": "Published",
            "active": "Active", "delivering": "Delivering",
            "completed": "Completed",
        },
        "transitions": {
            "drafted": ("published",), "published": ("active",),
            "active": ("delivering",), "delivering": ("completed",),
        },
    },
    "content": {
        "label": "Content",
        "color": "#34d399",
        "stages": ("idea", "created", "scheduled", "published", "performing"),
        "stage_labels": {
            "idea": "Idea", "created": "Created",
            "scheduled": "Scheduled", "published": "Published",
            "performing": "Performing",
        },
        "transitions": {
            "idea": ("created",), "created": ("scheduled",),
            "scheduled": ("published",), "published": ("performing",),
        },
    },
    "audio": {
        "label": "Audio",
        "color": "#fb923c",
        "stages": ("concept", "produced", "listed", "selling"),
        "stage_labels": {
            "concept": "Concept", "produced": "Produced",
            "listed": "Listed", "selling": "Selling",
        },
        "transitions": {
            "concept": ("produced",), "produced": ("listed",),
            "listed": ("selling",),
        },
    },
    "websites": {
        "label": "Client Sites",
        "color": "#f472b6",
        "stages": ("generated", "polished", "delivered"),
        "stage_labels": {
            "generated": "Mockup Generated", "polished": "Polished",
            "delivered": "Delivered to Lead",
        },
        "transitions": {
            "generated": ("polished",), "polished": ("delivered",),
        },
    },
    "gumroad": {
        "label": "Gumroad Products",
        "color": "#ff90e8",
        "stages": ("drafted", "designed", "published", "optimized", "selling"),
        "stage_labels": {
            "drafted": "Listing Drafted", "designed": "Assets Created",
            "published": "Published", "optimized": "SEO Optimized",
            "selling": "Selling",
        },
        "transitions": {
            "drafted": ("designed",), "designed": ("published",),
            "published": ("optimized",), "optimized": ("selling",),
        },
    },
    "freelance": {
        "label": "Freelance Gigs",
        "color": "#22d3ee",
        "stages": ("discovered", "qualified", "applied", "interviewing", "won", "delivered"),
        "stage_labels": {
            "discovered": "Discovered", "qualified": "Qualified",
            "applied": "Applied", "interviewing": "Interviewing",
            "won": "Won", "delivered": "Delivered",
        },
        "transitions": {
            "discovered": ("qualified",), "qualified": ("applied",),
            "applied": ("interviewing",), "interviewing": ("won",),
            "won": ("delivered",),
        },
    },
}

# Legacy aliases for lead gen agents
VALID_STAGES = PIPELINE_CONFIGS["leadgen"]["stages"]
VALID_TRANSITIONS = PIPELINE_CONFIGS["leadgen"]["transitions"]


class PipelineDB:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or Path(__file__).parent / "data" / "pipeline.db"
        self.db_path.parent.mkdir(exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._ensure_tables()

    def _ensure_tables(self):
        with self._lock:
            self._conn.executescript("""
                CREATE TABLE IF NOT EXISTS leads (
                    id              TEXT PRIMARY KEY,
                    business_name   TEXT NOT NULL,
                    industry        TEXT NOT NULL,
                    contact_name    TEXT,
                    contact_email   TEXT,
                    contact_phone   TEXT,
                    website         TEXT,
                    location        TEXT,
                    needs           TEXT,
                    stage           TEXT NOT NULL DEFAULT 'scraped',
                    score           INTEGER DEFAULT 0,
                    source          TEXT DEFAULT 'synthetic',
                    notes           TEXT,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
                CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
                CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

                CREATE TABLE IF NOT EXISTS pipeline_stages (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    lead_id     TEXT NOT NULL,
                    from_stage  TEXT,
                    to_stage    TEXT NOT NULL,
                    changed_by  TEXT NOT NULL,
                    changed_at  TEXT NOT NULL,
                    detail      TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_ps_lead ON pipeline_stages(lead_id);

                CREATE TABLE IF NOT EXISTS outreach_log (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    lead_id     TEXT NOT NULL,
                    channel     TEXT NOT NULL,
                    subject     TEXT,
                    body        TEXT NOT NULL,
                    status      TEXT DEFAULT 'drafted',
                    created_at  TEXT NOT NULL,
                    sent_at     TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach_log(lead_id);

                CREATE TABLE IF NOT EXISTS campaigns (
                    id              TEXT PRIMARY KEY,
                    name            TEXT NOT NULL,
                    industry        TEXT NOT NULL,
                    status          TEXT DEFAULT 'active',
                    target_count    INTEGER DEFAULT 50,
                    leads_generated INTEGER DEFAULT 0,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS pipeline_items (
                    id              TEXT PRIMARY KEY,
                    pipeline_type   TEXT NOT NULL,
                    title           TEXT NOT NULL,
                    subtitle        TEXT,
                    stage           TEXT NOT NULL,
                    score           INTEGER DEFAULT 0,
                    metadata        TEXT,
                    source_agent    TEXT,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_pi_type ON pipeline_items(pipeline_type);
                CREATE INDEX IF NOT EXISTS idx_pi_stage ON pipeline_items(stage);
                CREATE INDEX IF NOT EXISTS idx_pi_created ON pipeline_items(created_at);

                CREATE TABLE IF NOT EXISTS pipeline_transitions (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id         TEXT NOT NULL,
                    pipeline_type   TEXT NOT NULL,
                    from_stage      TEXT,
                    to_stage        TEXT NOT NULL,
                    changed_by      TEXT NOT NULL,
                    changed_at      TEXT NOT NULL,
                    detail          TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_pt_item ON pipeline_transitions(item_id);
            """)
            self._conn.commit()

    # ─── Leads ───

    def add_lead(self, data: dict, source: str = "synthetic") -> dict:
        lead_id = f"lead-{uuid.uuid4().hex[:8]}"
        now = datetime.now().isoformat()
        with self._lock:
            self._conn.execute(
                """INSERT INTO leads (id, business_name, industry, contact_name, contact_email,
                   contact_phone, website, location, needs, stage, score, source, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scraped', ?, ?, ?, ?)""",
                (lead_id, data.get("business_name", ""), data.get("industry", ""),
                 data.get("contact_name"), data.get("contact_email"),
                 data.get("contact_phone"), data.get("website"),
                 data.get("location"), data.get("needs"),
                 data.get("score", 50), source, now, now),
            )
            self._conn.execute(
                "INSERT INTO pipeline_stages (lead_id, from_stage, to_stage, changed_by, changed_at, detail) VALUES (?, NULL, 'scraped', ?, ?, ?)",
                (lead_id, "lead-scraper-001", now, "Initial scrape"),
            )
            self._conn.commit()
        return {"id": lead_id, "stage": "scraped", "created_at": now}

    def get_leads(self, stage: str = None, industry: str = None,
                  limit: int = 20, offset: int = 0) -> list[dict]:
        query = "SELECT * FROM leads"
        params = []
        conditions = []
        if stage and stage in VALID_STAGES:
            conditions.append("stage = ?")
            params.append(stage)
        if industry:
            conditions.append("industry = ?")
            params.append(industry)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_leads_by_stage(self, stage: str, limit: int = 10) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM leads WHERE stage = ? ORDER BY updated_at ASC LIMIT ?",
                (stage, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def update_lead_stage(self, lead_id: str, new_stage: str, changed_by: str, detail: str = "") -> bool:
        if new_stage not in VALID_STAGES:
            return False
        now = datetime.now().isoformat()
        with self._lock:
            row = self._conn.execute("SELECT stage FROM leads WHERE id = ?", (lead_id,)).fetchone()
            if not row:
                return False
            old_stage = row["stage"]
            # Validate transition
            if old_stage == new_stage:
                return False
            allowed = VALID_TRANSITIONS.get(old_stage, ())
            if new_stage not in allowed:
                return False

            self._conn.execute(
                "UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?",
                (new_stage, now, lead_id),
            )
            self._conn.execute(
                "INSERT INTO pipeline_stages (lead_id, from_stage, to_stage, changed_by, changed_at, detail) VALUES (?, ?, ?, ?, ?, ?)",
                (lead_id, old_stage, new_stage, changed_by, now, detail),
            )
            self._conn.commit()
        return True

    # ─── Outreach ───

    def add_outreach(self, lead_id: str, channel: str, subject: str, body: str) -> int:
        now = datetime.now().isoformat()
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO outreach_log (lead_id, channel, subject, body, status, created_at) VALUES (?, ?, ?, ?, 'drafted', ?)",
                (lead_id, channel, subject, body, now),
            )
            self._conn.commit()
        return cur.lastrowid

    def get_outreach_for_lead(self, lead_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM outreach_log WHERE lead_id = ? ORDER BY created_at DESC", (lead_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def has_outreach(self, lead_id: str) -> bool:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) as cnt FROM outreach_log WHERE lead_id = ?", (lead_id,)
            ).fetchone()
        return row["cnt"] > 0

    def has_item_for_lead(self, pipeline_type: str, lead_id: str) -> bool:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) as cnt FROM pipeline_items WHERE pipeline_type = ? AND metadata LIKE ?",
                (pipeline_type, f'%"{lead_id}"%'),
            ).fetchone()
        return row["cnt"] > 0

    # ─── Stats ───

    def get_stage_counts(self) -> list[dict]:
        labels = {
            "scraped": "Leads Scraped", "researched": "Research Done",
            "pitch_ready": "Pitch Ready", "contacted": "Contacted",
            "responded": "Responded", "closed": "Closed",
        }
        with self._lock:
            rows = self._conn.execute(
                "SELECT stage, COUNT(*) as count FROM leads GROUP BY stage"
            ).fetchall()
        counts = {s: 0 for s in VALID_STAGES}
        for r in rows:
            counts[r["stage"]] = r["count"]
        return [{"stage": s, "count": counts[s], "label": labels.get(s, s)} for s in VALID_STAGES]

    def get_pipeline_stats(self) -> dict:
        with self._lock:
            total = self._conn.execute("SELECT COUNT(*) as cnt FROM leads").fetchone()["cnt"]
            stage_rows = self._conn.execute(
                "SELECT stage, COUNT(*) as count FROM leads GROUP BY stage"
            ).fetchall()
            outreach_count = self._conn.execute(
                "SELECT COUNT(*) as cnt FROM outreach_log"
            ).fetchone()["cnt"]
            industry_rows = self._conn.execute(
                "SELECT industry, COUNT(*) as count FROM leads GROUP BY industry"
            ).fetchall()

        stage_counts = {s: 0 for s in VALID_STAGES}
        for r in stage_rows:
            stage_counts[r["stage"]] = r["count"]

        closed = stage_counts.get("closed", 0)
        return {
            "total_leads": total,
            "stage_counts": stage_counts,
            "outreach_drafted": outreach_count,
            "industries": {r["industry"]: r["count"] for r in industry_rows},
            "conversion_rate": round(closed / total, 3) if total > 0 else 0,
        }

    # ─── Generic Pipeline Items ───

    def add_item(self, pipeline_type: str, title: str, subtitle: str = None,
                 stage: str = None, score: int = 0, metadata: dict = None,
                 source_agent: str = None) -> dict:
        cfg = PIPELINE_CONFIGS.get(pipeline_type)
        if not cfg:
            return {}
        if not stage:
            stage = cfg["stages"][0]
        if stage not in cfg["stages"]:
            return {}

        item_id = f"item-{uuid.uuid4().hex[:8]}"
        now = datetime.now().isoformat()
        meta_json = json.dumps(metadata) if metadata else None

        with self._lock:
            self._conn.execute(
                """INSERT INTO pipeline_items
                   (id, pipeline_type, title, subtitle, stage, score, metadata, source_agent, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (item_id, pipeline_type, title, subtitle, stage, score, meta_json, source_agent, now, now),
            )
            self._conn.execute(
                """INSERT INTO pipeline_transitions
                   (item_id, pipeline_type, from_stage, to_stage, changed_by, changed_at, detail)
                   VALUES (?, ?, NULL, ?, ?, ?, ?)""",
                (item_id, pipeline_type, stage, source_agent or "system", now, "Created"),
            )
            self._conn.commit()
        return {"id": item_id, "pipeline_type": pipeline_type, "stage": stage, "created_at": now}

    def get_items(self, pipeline_type: str = None, stage: str = None,
                  limit: int = 20, offset: int = 0) -> list[dict]:
        query = "SELECT * FROM pipeline_items"
        params = []
        conditions = []
        if pipeline_type:
            conditions.append("pipeline_type = ?")
            params.append(pipeline_type)
        if stage:
            conditions.append("stage = ?")
            params.append(stage)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def update_item_stage(self, item_id: str, new_stage: str, changed_by: str, detail: str = "") -> bool:
        now = datetime.now().isoformat()
        with self._lock:
            row = self._conn.execute(
                "SELECT pipeline_type, stage FROM pipeline_items WHERE id = ?", (item_id,)
            ).fetchone()
            if not row:
                return False

            ptype = row["pipeline_type"]
            old_stage = row["stage"]
            cfg = PIPELINE_CONFIGS.get(ptype)
            if not cfg:
                return False
            if old_stage == new_stage:
                return False
            allowed = cfg["transitions"].get(old_stage, ())
            if new_stage not in allowed:
                return False

            self._conn.execute(
                "UPDATE pipeline_items SET stage = ?, updated_at = ? WHERE id = ?",
                (new_stage, now, item_id),
            )
            self._conn.execute(
                """INSERT INTO pipeline_transitions
                   (item_id, pipeline_type, from_stage, to_stage, changed_by, changed_at, detail)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (item_id, ptype, old_stage, new_stage, changed_by, now, detail),
            )
            self._conn.commit()
        return True

    def get_item_stats(self, pipeline_type: str = None) -> dict:
        """Stats for one pipeline type, or all types combined."""
        with self._lock:
            if pipeline_type:
                total = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM pipeline_items WHERE pipeline_type = ?",
                    (pipeline_type,)
                ).fetchone()["cnt"]
                stage_rows = self._conn.execute(
                    "SELECT stage, COUNT(*) as count FROM pipeline_items WHERE pipeline_type = ? GROUP BY stage",
                    (pipeline_type,)
                ).fetchall()
            else:
                total = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM pipeline_items"
                ).fetchone()["cnt"]
                stage_rows = self._conn.execute(
                    "SELECT stage, COUNT(*) as count FROM pipeline_items GROUP BY stage"
                ).fetchall()

        stage_counts = {}
        if pipeline_type:
            cfg = PIPELINE_CONFIGS.get(pipeline_type)
            if cfg:
                stage_counts = {s: 0 for s in cfg["stages"]}
        for r in stage_rows:
            stage_counts[r["stage"]] = r["count"]

        return {"total": total, "stage_counts": stage_counts, "pipeline_type": pipeline_type}

    def get_item_stage_counts(self, pipeline_type: str) -> list[dict]:
        cfg = PIPELINE_CONFIGS.get(pipeline_type)
        if not cfg:
            return []
        with self._lock:
            rows = self._conn.execute(
                "SELECT stage, COUNT(*) as count FROM pipeline_items WHERE pipeline_type = ? GROUP BY stage",
                (pipeline_type,)
            ).fetchall()
        counts = {s: 0 for s in cfg["stages"]}
        for r in rows:
            counts[r["stage"]] = r["count"]
        return [{"stage": s, "count": counts[s], "label": cfg["stage_labels"].get(s, s)} for s in cfg["stages"]]

    def get_all_pipeline_stats(self) -> dict:
        """Returns stats for every pipeline type (items + leadgen combined)."""
        result = {}
        # Lead gen stats (from leads table)
        result["leadgen"] = self.get_pipeline_stats()
        # Generic pipeline items
        for ptype in ("etsy", "fiverr", "content", "audio", "websites", "gumroad", "freelance"):
            result[ptype] = self.get_item_stats(ptype)
        return result

    def close(self):
        self._conn.close()
