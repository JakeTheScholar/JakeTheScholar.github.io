"""CEO Agent — chief executive, monitors all departments, generates strategic
reports, and sets cross-department priorities.

Runs every 180 seconds.  Each tick it pulls status from all agents via the
orchestrator, calculates department health scores, and emits an executive
summary event.
"""

import sys
import asyncio
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


# Which agents belong to each department
DEPARTMENTS = {
    "Content": [
        "printables-001", "etsy-lister-001", "social-001", "fiverr-001",
        "thumbnail-001", "research-001", "analytics-001", "seo-001", "scheduler-001",
    ],
    "Lead Gen": ["lead-scraper-001", "outreach-001", "follow-up-001", "pipeline-mgr-001"],
    "Growth": ["web-dev-001", "music-001", "ad-copy-001", "review-001"],
    "Revenue": ["image-gen-001", "faceless-content-001", "freelance-scraper-001", "gumroad-001", "video-producer-001"],
    "Operations": ["manager-001"],
}


class CEOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="ceo-001",
            name="CEO",
            description="Strategic oversight — monitors all departments and sets priorities",
            color="#ffd700",
        )
        self.tick_interval = 180
        self.orchestrator = None
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        if not self.orchestrator:
            return self.emit("idle", "Awaiting orchestrator link")

        agents = self.orchestrator.agents
        dept_reports = []
        total_tasks = 0
        total_running = 0
        total_agents = 0

        for dept_name, agent_ids in DEPARTMENTS.items():
            running = 0
            tasks = 0
            errors = 0
            for aid in agent_ids:
                agent = agents.get(aid)
                if not agent:
                    continue
                total_agents += 1
                tasks += agent.tasks_completed
                if agent.status == "running":
                    running += 1
                    total_running += 1
                elif agent.status == "error":
                    errors += 1
            total_tasks += tasks
            health = "nominal" if errors == 0 else f"{errors} errors"
            dept_reports.append(f"{dept_name}: {running}/{len(agent_ids)} active, {tasks} tasks, {health}")

        # Pipeline revenue snapshot
        pipeline_summary = ""
        if self.pipeline_db:
            try:
                stats = await asyncio.to_thread(self.pipeline_db.get_pipeline_stats)
                total_leads = stats.get("total", 0)
                closed = stats.get("stages", {}).get("closed", 0)
                pipeline_summary = f" | Pipeline: {total_leads} leads, {closed} closed"
            except Exception:
                pass

        self.current_task = {
            "type": "executive_summary",
            "description": f"Monitoring {total_agents} agents across {len(DEPARTMENTS)} departments",
        }

        summary = (
            f"Executive Summary: {total_running}/{total_agents} agents active, "
            f"{total_tasks} total tasks completed{pipeline_summary}"
        )

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("executive_report", summary)

    def get_tools(self) -> list[dict]:
        return []
