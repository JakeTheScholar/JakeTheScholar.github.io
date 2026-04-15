"""CMO Agent — chief marketing officer, oversees marketing strategy, campaign
performance, social engagement, and ad effectiveness.

Runs every 160 seconds.
"""

import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


# Agents under marketing oversight
MARKETING_AGENTS = ["social-001", "ad-copy-001", "seo-001", "outreach-001"]


class CMOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="cmo-001",
            name="CMO",
            description="Marketing strategy — campaigns, social, ads, brand growth",
            color="#e040fb",
        )
        self.tick_interval = 160
        self.orchestrator = None
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        self.current_task = {
            "type": "marketing_report",
            "description": "Analyzing marketing performance",
        }

        self.emit("analyzing", "Reviewing marketing channels and campaigns")

        parts = []

        # Check marketing agent status
        if self.orchestrator:
            agents = self.orchestrator.agents
            active_marketing = 0
            marketing_tasks = 0
            for aid in MARKETING_AGENTS:
                agent = agents.get(aid)
                if agent:
                    marketing_tasks += agent.tasks_completed
                    if agent.status == "running":
                        active_marketing += 1
            parts.append(f"Marketing team: {active_marketing}/{len(MARKETING_AGENTS)} active, {marketing_tasks} tasks done")

        # Campaign and outreach metrics
        if self.pipeline_db:
            try:
                # Content pipeline (ads, social posts)
                all_stats = await asyncio.to_thread(self.pipeline_db.get_all_pipeline_stats)
                content_stats = all_stats.get("content", {})
                content_total = content_stats.get("total", 0)
                if content_total:
                    parts.append(f"Content pipeline: {content_total} pieces")

                # Outreach metrics
                try:
                    outreach_stats = await asyncio.to_thread(self.pipeline_db.get_outreach_stats)
                    total_outreach = outreach_stats.get("total", 0)
                    sent = outreach_stats.get("sent", 0)
                    responded = outreach_stats.get("responded", 0)
                    if total_outreach > 0:
                        parts.append(f"Outreach: {sent} sent, {responded} responded")
                except Exception:
                    pass

                # Lead quality for marketing effectiveness
                try:
                    lead_stats = await asyncio.to_thread(self.pipeline_db.get_pipeline_stats)
                    avg_score = lead_stats.get("avg_score")
                    if avg_score is not None:
                        parts.append(f"Avg lead quality: {avg_score:.0f}/100")
                except Exception:
                    pass

            except Exception:
                pass

        if not parts:
            parts.append("Marketing systems initializing — gathering channel data")

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("marketing_report", " | ".join(parts))

    def get_tools(self) -> list[dict]:
        return []
