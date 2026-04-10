"""SQLite database layer for multi-pipeline tracking."""

import sqlite3
import uuid
import json
import threading
from pathlib import Path
from datetime import datetime, timedelta
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
    def __init__(self, db_path=None):
        self.db_path = db_path or Path(__file__).parent / "data" / "pipeline.db"
        if str(self.db_path) != ":memory:":
            Path(self.db_path).parent.mkdir(exist_ok=True)
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

    def get_item_for_lead(self, pipeline_type: str, lead_id: str) -> Optional[dict]:
        """Fetch the most recent pipeline item linked to a lead via metadata.lead_id."""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM pipeline_items WHERE pipeline_type = ? AND metadata LIKE ? "
                "ORDER BY updated_at DESC LIMIT 1",
                (pipeline_type, f'%"{lead_id}"%'),
            ).fetchone()
        if not row:
            return None
        item = dict(row)
        if item.get("metadata"):
            try:
                item["metadata"] = json.loads(item["metadata"])
            except json.JSONDecodeError:
                pass
        return item

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

    # ─── Performance Metrics ───

    def get_funnel_conversion(self, pipeline_type: str = "leadgen") -> list[dict]:
        """Conversion rate between each consecutive stage pair."""
        if pipeline_type == "leadgen":
            stages = list(VALID_STAGES)
            with self._lock:
                counts = {}
                for s in stages:
                    row = self._conn.execute(
                        "SELECT COUNT(*) as cnt FROM leads WHERE stage = ?", (s,)
                    ).fetchone()
                    counts[s] = row["cnt"]
        else:
            cfg = PIPELINE_CONFIGS.get(pipeline_type)
            if not cfg:
                return []
            stages = list(cfg["stages"])
            with self._lock:
                counts = {}
                for s in stages:
                    row = self._conn.execute(
                        "SELECT COUNT(*) as cnt FROM pipeline_items WHERE pipeline_type = ? AND stage = ?",
                        (pipeline_type, s),
                    ).fetchone()
                    counts[s] = row["cnt"]

        # Cumulative: a lead at "closed" has passed through all prior stages
        cumulative = {}
        running = 0
        for s in reversed(stages):
            running += counts.get(s, 0)
            cumulative[s] = running

        result = []
        for i in range(len(stages) - 1):
            from_s, to_s = stages[i], stages[i + 1]
            fc = cumulative.get(from_s, 0)
            tc = cumulative.get(to_s, 0)
            rate = tc / fc if fc > 0 else 0.0
            result.append({
                "from_stage": from_s, "to_stage": to_s,
                "from_count": fc, "to_count": tc,
                "conversion_rate": round(rate, 4),
            })
        return result

    def get_time_to_stage_stats(self, pipeline_type: str = "leadgen") -> dict:
        """Average and median hours between consecutive stage transitions."""
        if pipeline_type == "leadgen":
            with self._lock:
                rows = self._conn.execute(
                    """SELECT a.lead_id, a.to_stage AS from_stage, b.to_stage AS to_stage,
                       (julianday(b.changed_at) - julianday(a.changed_at)) * 24 AS hours
                       FROM pipeline_stages a
                       JOIN pipeline_stages b ON a.lead_id = b.lead_id
                         AND a.to_stage = b.from_stage
                       WHERE a.to_stage IS NOT NULL AND b.from_stage IS NOT NULL
                       ORDER BY a.lead_id, a.changed_at"""
                ).fetchall()
        else:
            with self._lock:
                rows = self._conn.execute(
                    """SELECT a.item_id, a.to_stage AS from_stage, b.to_stage AS to_stage,
                       (julianday(b.changed_at) - julianday(a.changed_at)) * 24 AS hours
                       FROM pipeline_transitions a
                       JOIN pipeline_transitions b ON a.item_id = b.item_id
                         AND a.to_stage = b.from_stage
                         AND a.pipeline_type = b.pipeline_type
                       WHERE a.to_stage IS NOT NULL AND b.from_stage IS NOT NULL
                         AND a.pipeline_type = ?
                       ORDER BY a.item_id, a.changed_at""",
                    (pipeline_type,),
                ).fetchall()

        buckets: dict[str, list[float]] = {}
        for r in rows:
            key = f"{r['from_stage']}_to_{r['to_stage']}"
            buckets.setdefault(key, []).append(r["hours"])

        result = {}
        for key, hours_list in buckets.items():
            hours_list.sort()
            n = len(hours_list)
            avg = sum(hours_list) / n
            median = hours_list[n // 2] if n % 2 == 1 else (hours_list[n // 2 - 1] + hours_list[n // 2]) / 2
            result[key] = {
                "avg_hours": round(avg, 2),
                "median_hours": round(median, 2),
                "count": n,
            }

        # Total cycle: first entry to final stage per lead/item
        if pipeline_type == "leadgen":
            with self._lock:
                cycle_rows = self._conn.execute(
                    """SELECT lead_id,
                       (julianday(MAX(changed_at)) - julianday(MIN(changed_at))) * 24 AS hours
                       FROM pipeline_stages
                       WHERE lead_id IN (SELECT id FROM leads WHERE stage = ?)
                       GROUP BY lead_id
                       HAVING COUNT(*) > 1""",
                    (VALID_STAGES[-1],),
                ).fetchall()
        else:
            cfg = PIPELINE_CONFIGS.get(pipeline_type)
            final = cfg["stages"][-1] if cfg else None
            if final:
                with self._lock:
                    cycle_rows = self._conn.execute(
                        """SELECT item_id,
                           (julianday(MAX(changed_at)) - julianday(MIN(changed_at))) * 24 AS hours
                           FROM pipeline_transitions
                           WHERE pipeline_type = ?
                             AND item_id IN (SELECT id FROM pipeline_items WHERE stage = ? AND pipeline_type = ?)
                           GROUP BY item_id
                           HAVING COUNT(*) > 1""",
                        (pipeline_type, final, pipeline_type),
                    ).fetchall()
            else:
                cycle_rows = []

        if cycle_rows:
            cycle_hours = sorted([r["hours"] for r in cycle_rows])
            n = len(cycle_hours)
            avg = sum(cycle_hours) / n
            median = cycle_hours[n // 2] if n % 2 == 1 else (cycle_hours[n // 2 - 1] + cycle_hours[n // 2]) / 2
            result["total_cycle"] = {
                "avg_hours": round(avg, 2),
                "median_hours": round(median, 2),
                "count": n,
            }

        return result

    def get_lead_lifecycle(self, lead_id: str) -> list[dict]:
        """Ordered stage transitions for a single lead with time in each stage."""
        with self._lock:
            rows = self._conn.execute(
                """SELECT from_stage, to_stage, changed_by, changed_at, detail
                   FROM pipeline_stages WHERE lead_id = ?
                   ORDER BY changed_at""",
                (lead_id,),
            ).fetchall()
        if not rows:
            return []

        transitions = [dict(r) for r in rows]
        for i, t in enumerate(transitions):
            if i < len(transitions) - 1:
                cur = datetime.fromisoformat(t["changed_at"])
                nxt = datetime.fromisoformat(transitions[i + 1]["changed_at"])
                t["hours_in_stage"] = round((nxt - cur).total_seconds() / 3600, 2)
            else:
                t["hours_in_stage"] = None
        return transitions

    def get_score_distribution(self, pipeline_type: str = None) -> dict:
        """Score percentiles, histogram buckets, avg/median/min/max."""
        if pipeline_type and pipeline_type != "leadgen":
            with self._lock:
                rows = self._conn.execute(
                    "SELECT score FROM pipeline_items WHERE pipeline_type = ? ORDER BY score",
                    (pipeline_type,),
                ).fetchall()
        else:
            with self._lock:
                rows = self._conn.execute(
                    "SELECT score FROM leads ORDER BY score"
                ).fetchall()

        scores = [r["score"] for r in rows]
        n = len(scores)
        if n == 0:
            return {"avg": 0, "median": 0, "min": 0, "max": 0,
                    "p25": 0, "p75": 0, "count": 0,
                    "buckets": {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}}

        avg = sum(scores) / n
        median = scores[n // 2] if n % 2 == 1 else (scores[n // 2 - 1] + scores[n // 2]) / 2
        p25 = scores[n // 4]
        p75 = scores[(3 * n) // 4]

        buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
        for s in scores:
            if s <= 20:
                buckets["0-20"] += 1
            elif s <= 40:
                buckets["21-40"] += 1
            elif s <= 60:
                buckets["41-60"] += 1
            elif s <= 80:
                buckets["61-80"] += 1
            else:
                buckets["81-100"] += 1

        return {
            "avg": round(avg, 2), "median": median,
            "min": scores[0], "max": scores[-1],
            "p25": p25, "p75": p75,
            "count": n, "buckets": buckets,
        }

    def get_score_by_stage(self, pipeline_type: str = "leadgen") -> dict:
        """Average score per stage."""
        if pipeline_type == "leadgen":
            with self._lock:
                rows = self._conn.execute(
                    "SELECT stage, AVG(score) as avg_score, COUNT(*) as count FROM leads GROUP BY stage"
                ).fetchall()
            result = {s: {"avg_score": 0, "count": 0} for s in VALID_STAGES}
        else:
            cfg = PIPELINE_CONFIGS.get(pipeline_type)
            if not cfg:
                return {}
            with self._lock:
                rows = self._conn.execute(
                    "SELECT stage, AVG(score) as avg_score, COUNT(*) as count "
                    "FROM pipeline_items WHERE pipeline_type = ? GROUP BY stage",
                    (pipeline_type,),
                ).fetchall()
            result = {s: {"avg_score": 0, "count": 0} for s in cfg["stages"]}

        for r in rows:
            result[r["stage"]] = {
                "avg_score": round(r["avg_score"], 2),
                "count": r["count"],
            }
        return result

    def get_score_by_industry(self) -> dict:
        """Average score per industry (leadgen only)."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT industry, AVG(score) as avg_score, COUNT(*) as count "
                "FROM leads GROUP BY industry"
            ).fetchall()
        return {
            r["industry"]: {"avg_score": round(r["avg_score"], 2), "count": r["count"]}
            for r in rows
        }

    def get_outreach_stats(self) -> dict:
        """Outreach engagement: drafted vs sent, by channel, avg draft-to-send time."""
        with self._lock:
            total = self._conn.execute("SELECT COUNT(*) as cnt FROM outreach_log").fetchone()["cnt"]
            sent = self._conn.execute("SELECT COUNT(*) as cnt FROM outreach_log WHERE status = 'sent'").fetchone()["cnt"]
            drafted = total - sent

            channel_rows = self._conn.execute(
                "SELECT channel, status, COUNT(*) as cnt FROM outreach_log GROUP BY channel, status"
            ).fetchall()

            time_row = self._conn.execute(
                """SELECT AVG((julianday(sent_at) - julianday(created_at)) * 24) as avg_hours
                   FROM outreach_log WHERE sent_at IS NOT NULL"""
            ).fetchone()

        by_channel: dict[str, dict] = {}
        for r in channel_rows:
            ch = r["channel"]
            by_channel.setdefault(ch, {"total": 0, "sent": 0})
            by_channel[ch]["total"] += r["cnt"]
            if r["status"] == "sent":
                by_channel[ch]["sent"] += r["cnt"]

        result = {
            "total": total, "drafted": drafted, "sent": sent,
            "send_rate": round(sent / total, 4) if total > 0 else 0.0,
            "by_channel": by_channel,
        }
        if time_row and time_row["avg_hours"] is not None:
            result["avg_draft_to_send_hours"] = round(time_row["avg_hours"], 2)
        else:
            result["avg_draft_to_send_hours"] = 0

        return result

    def get_industry_performance(self) -> list[dict]:
        """Close rate, avg score, avg days-to-close, stage distribution per industry."""
        with self._lock:
            industries = self._conn.execute(
                "SELECT DISTINCT industry FROM leads"
            ).fetchall()

        result = []
        for ind_row in industries:
            industry = ind_row["industry"]
            with self._lock:
                total = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM leads WHERE industry = ?", (industry,)
                ).fetchone()["cnt"]
                closed = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM leads WHERE industry = ? AND stage = 'closed'",
                    (industry,),
                ).fetchone()["cnt"]
                avg_score = self._conn.execute(
                    "SELECT AVG(score) as avg FROM leads WHERE industry = ?", (industry,)
                ).fetchone()["avg"]
                stage_rows = self._conn.execute(
                    "SELECT stage, COUNT(*) as cnt FROM leads WHERE industry = ? GROUP BY stage",
                    (industry,),
                ).fetchall()

                # Avg days to close
                days_rows = self._conn.execute(
                    """SELECT l.id,
                       (julianday(MAX(ps.changed_at)) - julianday(MIN(ps.changed_at))) as days
                       FROM leads l
                       JOIN pipeline_stages ps ON l.id = ps.lead_id
                       WHERE l.industry = ? AND l.stage = 'closed'
                       GROUP BY l.id""",
                    (industry,),
                ).fetchall()

            stage_dist = {r["stage"]: r["cnt"] for r in stage_rows}
            avg_days = 0.0
            if days_rows:
                avg_days = sum(r["days"] for r in days_rows) / len(days_rows)

            result.append({
                "industry": industry,
                "total": total,
                "closed": closed,
                "close_rate": round(closed / total, 4) if total > 0 else 0.0,
                "avg_score": round(avg_score, 2) if avg_score else 0,
                "avg_days_to_close": round(avg_days, 2),
                "stage_distribution": stage_dist,
            })
        return result

    def get_agent_velocity(self, days: int = 7) -> list[dict]:
        """Items/leads created per agent within the last N days."""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()

        with self._lock:
            lead_rows = self._conn.execute(
                """SELECT source as agent_id, COUNT(*) as cnt
                   FROM leads WHERE created_at >= ? GROUP BY source""",
                (cutoff,),
            ).fetchall()
            item_rows = self._conn.execute(
                """SELECT source_agent as agent_id, COUNT(*) as cnt
                   FROM pipeline_items WHERE created_at >= ? GROUP BY source_agent""",
                (cutoff,),
            ).fetchall()

        agents: dict[str, int] = {}
        for r in lead_rows:
            if r["agent_id"]:
                agents[r["agent_id"]] = agents.get(r["agent_id"], 0) + r["cnt"]
        for r in item_rows:
            if r["agent_id"]:
                agents[r["agent_id"]] = agents.get(r["agent_id"], 0) + r["cnt"]

        return [
            {
                "agent_id": aid,
                "items_created": cnt,
                "period_days": days,
                "items_per_day": round(cnt / days, 2),
            }
            for aid, cnt in sorted(agents.items(), key=lambda x: -x[1])
        ]

    def get_agent_stage_contributions(self, agent_id: str) -> dict:
        """Which stages an agent pushes items/leads into."""
        with self._lock:
            lead_rows = self._conn.execute(
                "SELECT to_stage, COUNT(*) as cnt FROM pipeline_stages WHERE changed_by = ? GROUP BY to_stage",
                (agent_id,),
            ).fetchall()
            item_rows = self._conn.execute(
                "SELECT to_stage, COUNT(*) as cnt FROM pipeline_transitions WHERE changed_by = ? GROUP BY to_stage",
                (agent_id,),
            ).fetchall()

        transitions: dict[str, int] = {}
        for r in lead_rows:
            transitions[r["to_stage"]] = transitions.get(r["to_stage"], 0) + r["cnt"]
        for r in item_rows:
            transitions[r["to_stage"]] = transitions.get(r["to_stage"], 0) + r["cnt"]

        return {
            "agent_id": agent_id,
            "transitions": transitions,
            "total_transitions": sum(transitions.values()),
        }

    def get_source_agent_performance(self, pipeline_type: str = None) -> list[dict]:
        """Avg score, item count, advancement rate per source agent."""
        if pipeline_type == "leadgen" or pipeline_type is None:
            with self._lock:
                rows = self._conn.execute(
                    """SELECT source as source_agent, COUNT(*) as items_created,
                       AVG(score) as avg_score
                       FROM leads GROUP BY source"""
                ).fetchall()
        else:
            with self._lock:
                rows = self._conn.execute(
                    """SELECT source_agent, COUNT(*) as items_created,
                       AVG(score) as avg_score
                       FROM pipeline_items WHERE pipeline_type = ? GROUP BY source_agent""",
                    (pipeline_type,),
                ).fetchall()

        return [
            {
                "source_agent": r["source_agent"],
                "items_created": r["items_created"],
                "avg_score": round(r["avg_score"], 2) if r["avg_score"] else 0,
            }
            for r in rows if r["source_agent"]
        ]

    def get_lead_quality_cohorts(self) -> dict:
        """High/medium/low score buckets with conversion rates."""
        cohorts = {
            "high": {"score_range": "70-100", "min": 70, "max": 100},
            "medium": {"score_range": "40-69", "min": 40, "max": 69},
            "low": {"score_range": "0-39", "min": 0, "max": 39},
        }
        result = {}
        for name, cfg in cohorts.items():
            with self._lock:
                total = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM leads WHERE score >= ? AND score <= ?",
                    (cfg["min"], cfg["max"]),
                ).fetchone()["cnt"]
                closed = self._conn.execute(
                    "SELECT COUNT(*) as cnt FROM leads WHERE score >= ? AND score <= ? AND stage = 'closed'",
                    (cfg["min"], cfg["max"]),
                ).fetchone()["cnt"]
                stage_rows = self._conn.execute(
                    "SELECT stage, COUNT(*) as cnt FROM leads WHERE score >= ? AND score <= ? GROUP BY stage",
                    (cfg["min"], cfg["max"]),
                ).fetchall()

            result[name] = {
                "score_range": cfg["score_range"],
                "count": total,
                "closed": closed,
                "conversion_rate": round(closed / total, 4) if total > 0 else 0.0,
                "stages": {r["stage"]: r["cnt"] for r in stage_rows},
            }
        return result

    def get_outreach_roi(self) -> dict:
        """Compare close rates for leads with vs without outreach."""
        with self._lock:
            with_rows = self._conn.execute(
                """SELECT COUNT(*) as cnt,
                   SUM(CASE WHEN l.stage = 'closed' THEN 1 ELSE 0 END) as closed,
                   AVG(l.score) as avg_score
                   FROM leads l
                   WHERE l.id IN (SELECT DISTINCT lead_id FROM outreach_log)"""
            ).fetchone()
            without_rows = self._conn.execute(
                """SELECT COUNT(*) as cnt,
                   SUM(CASE WHEN l.stage = 'closed' THEN 1 ELSE 0 END) as closed,
                   AVG(l.score) as avg_score
                   FROM leads l
                   WHERE l.id NOT IN (SELECT DISTINCT lead_id FROM outreach_log)"""
            ).fetchone()

        w_cnt = with_rows["cnt"] or 0
        w_closed = with_rows["closed"] or 0
        w_score = with_rows["avg_score"] or 0
        wo_cnt = without_rows["cnt"] or 0
        wo_closed = without_rows["closed"] or 0
        wo_score = without_rows["avg_score"] or 0

        w_rate = w_closed / w_cnt if w_cnt > 0 else 0.0
        wo_rate = wo_closed / wo_cnt if wo_cnt > 0 else 0.0

        return {
            "with_outreach": {
                "count": w_cnt, "closed": w_closed,
                "close_rate": round(w_rate, 4),
                "avg_score": round(w_score, 2),
            },
            "without_outreach": {
                "count": wo_cnt, "closed": wo_closed,
                "close_rate": round(wo_rate, 4),
                "avg_score": round(wo_score, 2),
            },
            "close_rate_delta": round(w_rate - wo_rate, 4),
        }

    def get_creation_trend(self, pipeline_type: str = "leadgen",
                           period: str = "day", days: int = 30) -> list[dict]:
        """Items/leads created per day or week."""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        if period == "week":
            date_expr = "strftime('%Y-W%W', created_at)"
        else:
            date_expr = "date(created_at)"

        if pipeline_type == "leadgen":
            query = f"SELECT {date_expr} as date, COUNT(*) as count FROM leads WHERE created_at >= ? GROUP BY 1 ORDER BY 1"
            params = (cutoff,)
        else:
            query = f"SELECT {date_expr} as date, COUNT(*) as count FROM pipeline_items WHERE pipeline_type = ? AND created_at >= ? GROUP BY 1 ORDER BY 1"
            params = (pipeline_type, cutoff)

        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [{"date": r["date"], "count": r["count"]} for r in rows]

    def get_transition_trend(self, pipeline_type: str = "leadgen",
                             days: int = 30) -> list[dict]:
        """Stage transitions per day."""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()

        if pipeline_type == "leadgen":
            query = "SELECT date(changed_at) as date, COUNT(*) as transitions FROM pipeline_stages WHERE changed_at >= ? GROUP BY 1 ORDER BY 1"
            params = (cutoff,)
        else:
            query = "SELECT date(changed_at) as date, COUNT(*) as transitions FROM pipeline_transitions WHERE pipeline_type = ? AND changed_at >= ? GROUP BY 1 ORDER BY 1"
            params = (pipeline_type, cutoff)

        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [{"date": r["date"], "transitions": r["transitions"]} for r in rows]

    def get_campaign_stats(self) -> list[dict]:
        """Campaign effectiveness: completion rate, days active."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM campaigns ORDER BY created_at DESC"
            ).fetchall()

        now = datetime.now()
        result = []
        for r in rows:
            created = datetime.fromisoformat(r["created_at"])
            days_active = max(0, (now - created).days)
            target = r["target_count"] or 1
            result.append({
                "id": r["id"],
                "name": r["name"],
                "industry": r["industry"],
                "status": r["status"],
                "target_count": r["target_count"],
                "leads_generated": r["leads_generated"],
                "completion_rate": round(r["leads_generated"] / target, 4),
                "days_active": days_active,
                "created_at": r["created_at"],
            })
        return result

    def get_comprehensive_metrics(self) -> dict:
        """All metrics in a single response."""
        return {
            "generated_at": datetime.now().isoformat(),
            "time_to_stage": self.get_time_to_stage_stats("leadgen"),
            "agent_velocity": self.get_agent_velocity(30),
            "score_distribution": self.get_score_distribution(),
            "outreach": self.get_outreach_stats(),
            "lead_quality": self.get_lead_quality_cohorts(),
            "industry": self.get_industry_performance(),
            "funnel": self.get_funnel_conversion("leadgen"),
            "source_agents": self.get_source_agent_performance(),
            "creation_trend": self.get_creation_trend("leadgen", "day", 30),
            "outreach_roi": self.get_outreach_roi(),
            "campaigns": self.get_campaign_stats(),
        }

    def close(self):
        self._conn.close()
