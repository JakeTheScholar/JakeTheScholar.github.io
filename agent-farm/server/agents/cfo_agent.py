"""CFO Agent — chief financial officer, tracks revenue metrics, ROI on ads
and listings, generates financial reports from pipeline data.

Runs every 200 seconds.
"""

import sys
import asyncio
import random
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


class CFOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="cfo-001",
            name="CFO",
            description="Financial oversight — revenue tracking, ROI analysis, cost optimization",
            color="#00e676",
        )
        self.tick_interval = 200
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        self.current_task = {
            "type": "financial_report",
            "description": "Generating financial performance report",
        }

        self.emit("analyzing", "Pulling pipeline financials and ROI data")

        report_parts = []

        if self.pipeline_db:
            try:
                # Gather cross-pipeline stats
                all_stats = await asyncio.to_thread(self.pipeline_db.get_all_pipeline_stats)

                for ptype, stats in all_stats.items():
                    total = stats.get("total", 0)
                    if total > 0:
                        report_parts.append(f"{ptype}: {total} items")

                # Lead gen funnel
                lead_stats = await asyncio.to_thread(self.pipeline_db.get_pipeline_stats)
                total_leads = lead_stats.get("total", 0)
                stages = lead_stats.get("stages", {})
                closed = stages.get("closed", 0)
                contacted = stages.get("contacted", 0)
                close_rate = f"{(closed / contacted * 100):.1f}%" if contacted > 0 else "N/A"

                report_parts.append(
                    f"Lead funnel: {total_leads} total, {contacted} contacted, "
                    f"{closed} closed ({close_rate} close rate)"
                )

                # Outreach ROI
                try:
                    roi_data = await asyncio.to_thread(self.pipeline_db.get_outreach_roi)
                    sent = roi_data.get("total_sent", 0)
                    responded = roi_data.get("total_responded", 0)
                    if sent > 0:
                        resp_rate = f"{(responded / sent * 100):.1f}%"
                        report_parts.append(f"Outreach ROI: {sent} sent, {responded} responded ({resp_rate})")
                except Exception:
                    pass

            except Exception as e:
                report_parts.append(f"Pipeline data unavailable: {e}")
        else:
            report_parts.append("No pipeline connection — awaiting data feed")

        summary = " | ".join(report_parts) if report_parts else "Financial systems initializing"

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("financial_report", summary)

    def get_tools(self) -> list[dict]:
        return []
