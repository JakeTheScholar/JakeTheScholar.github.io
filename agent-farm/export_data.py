"""Export Agent Farm pipeline data to CSV spreadsheets for easy tracking.

Usage:
    python export_data.py           # Export all data
    python export_data.py leads     # Export only leads
    python export_data.py pipeline  # Export only pipeline items
    python export_data.py agents    # Export agent activity summary
"""

import csv
import sqlite3
import sys
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "server" / "data" / "pipeline.db"
OUTPUT_DIR = Path(__file__).parent / "exports"


def connect():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Start the Agent Farm server first to create the database.")
        sys.exit(1)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def export_leads(conn):
    """Export all leads to CSV."""
    rows = conn.execute(
        "SELECT id, business_name, industry, contact_name, contact_email, "
        "contact_phone, website, location, needs, stage, score, source, "
        "created_at, updated_at FROM leads ORDER BY created_at DESC"
    ).fetchall()

    if not rows:
        print("  No leads found.")
        return

    filepath = OUTPUT_DIR / f"leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Lead ID", "Business Name", "Industry", "Contact Name", "Email",
            "Phone", "Website", "Location", "Needs/Pain Points", "Stage",
            "Score", "Source", "Created", "Last Updated"
        ])
        for row in rows:
            needs = row["needs"]
            # Try to parse JSON needs into readable string
            try:
                needs_list = json.loads(needs)
                if isinstance(needs_list, list):
                    needs = "; ".join(needs_list)
            except (json.JSONDecodeError, TypeError):
                pass
            writer.writerow([
                row["id"], row["business_name"], row["industry"],
                row["contact_name"], row["contact_email"], row["contact_phone"],
                row["website"], row["location"], needs, row["stage"],
                row["score"], row["source"], row["created_at"], row["updated_at"]
            ])

    print(f"  Leads: {len(rows)} rows -> {filepath.name}")


def export_pipeline_items(conn):
    """Export all pipeline items (Etsy, Gumroad, Fiverr, etc.) to CSV."""
    rows = conn.execute(
        "SELECT id, pipeline_type, title, subtitle, stage, score, metadata, "
        "source_agent, created_at, updated_at FROM pipeline_items "
        "ORDER BY pipeline_type, created_at DESC"
    ).fetchall()

    if not rows:
        print("  No pipeline items found.")
        return

    filepath = OUTPUT_DIR / f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Item ID", "Pipeline", "Title", "Subtitle", "Stage", "Score",
            "Source Agent", "Created", "Last Updated", "Metadata"
        ])
        for row in rows:
            metadata = row["metadata"] or ""
            try:
                meta = json.loads(metadata)
                metadata = "; ".join(f"{k}={v}" for k, v in meta.items())
            except (json.JSONDecodeError, TypeError):
                pass
            writer.writerow([
                row["id"], row["pipeline_type"], row["title"], row["subtitle"],
                row["stage"], row["score"], row["source_agent"],
                row["created_at"], row["updated_at"], metadata
            ])

    print(f"  Pipeline items: {len(rows)} rows -> {filepath.name}")


def export_outreach(conn):
    """Export outreach log to CSV."""
    rows = conn.execute(
        "SELECT o.id, o.lead_id, l.business_name, l.industry, o.channel, "
        "o.subject, o.body, o.status, o.created_at, o.sent_at "
        "FROM outreach_log o LEFT JOIN leads l ON o.lead_id = l.id "
        "ORDER BY o.created_at DESC"
    ).fetchall()

    if not rows:
        print("  No outreach records found.")
        return

    filepath = OUTPUT_DIR / f"outreach_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "Lead ID", "Business", "Industry", "Channel",
            "Subject", "Body", "Status", "Created", "Sent At"
        ])
        for row in rows:
            writer.writerow([dict(row)[k] for k in [
                "id", "lead_id", "business_name", "industry", "channel",
                "subject", "body", "status", "created_at", "sent_at"
            ]])

    print(f"  Outreach: {len(rows)} rows -> {filepath.name}")


def export_agent_summary(conn):
    """Export agent activity summary."""
    # Count items per agent
    agent_items = conn.execute(
        "SELECT source_agent, pipeline_type, stage, COUNT(*) as count "
        "FROM pipeline_items GROUP BY source_agent, pipeline_type, stage "
        "ORDER BY source_agent"
    ).fetchall()

    # Count leads
    lead_counts = conn.execute(
        "SELECT stage, COUNT(*) as count FROM leads GROUP BY stage"
    ).fetchall()

    filepath = OUTPUT_DIR / f"agent_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow(["=== LEAD PIPELINE SUMMARY ===", "", ""])
        writer.writerow(["Stage", "Count", ""])
        for row in lead_counts:
            writer.writerow([row["stage"], row["count"], ""])

        writer.writerow([])
        writer.writerow(["=== AGENT CONTRIBUTIONS ===", "", "", ""])
        writer.writerow(["Agent", "Pipeline", "Stage", "Count"])
        for row in agent_items:
            writer.writerow([
                row["source_agent"], row["pipeline_type"],
                row["stage"], row["count"]
            ])

    print(f"  Agent summary -> {filepath.name}")


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"

    OUTPUT_DIR.mkdir(exist_ok=True)
    conn = connect()

    print(f"Exporting Agent Farm data ({datetime.now().strftime('%Y-%m-%d %H:%M')})...")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    if what in ("all", "leads"):
        export_leads(conn)
    if what in ("all", "pipeline"):
        export_pipeline_items(conn)
    if what in ("all", "outreach"):
        export_outreach(conn)
    if what in ("all", "agents"):
        export_agent_summary(conn)

    conn.close()
    print()
    print("Done! Open CSV files in Excel or Google Sheets.")


if __name__ == "__main__":
    main()
