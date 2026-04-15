"""Pipeline Manager Agent — advances leads through stages and generates reports."""

import sys
import json
import asyncio
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


class PipelineManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="pipeline-mgr-001",
            name="Pipeline Manager",
            description="Pipeline ops & status reports",
            color="#a855f7",
        )
        self.tick_interval = 120
        self.pipeline_db = None  # Injected by orchestrator
        self.tick_count = 0

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        self.tick_count += 1

        # Get current stats
        stats = await asyncio.to_thread(self.pipeline_db.get_pipeline_stats)

        # Simulate pipeline movement: advance some leads
        advanced = 0

        # Move pitch_ready → contacted (simulate sending emails)
        pitch_leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "pitch_ready", 5
        )
        for lead in pitch_leads[:random.randint(0, 2)]:
            ok = await asyncio.to_thread(
                self.pipeline_db.update_lead_stage,
                lead["id"], "contacted", self.agent_id, "Email sent (simulated)"
            )
            if ok:
                advanced += 1

        # Move contacted → responded (simulate replies, lower rate)
        contacted_leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "contacted", 5
        )
        for lead in contacted_leads[:random.randint(0, 1)]:
            if random.random() < 0.4:  # 40% reply rate
                ok = await asyncio.to_thread(
                    self.pipeline_db.update_lead_stage,
                    lead["id"], "responded", self.agent_id, "Reply received (simulated)"
                )
                if ok:
                    advanced += 1

        # Move responded → closed (simulate deals, low rate)
        responded_leads = await asyncio.to_thread(
            self.pipeline_db.get_leads_by_stage, "responded", 5
        )
        for lead in responded_leads[:1]:
            if random.random() < 0.25:  # 25% close rate
                ok = await asyncio.to_thread(
                    self.pipeline_db.update_lead_stage,
                    lead["id"], "closed", self.agent_id, "Deal closed (simulated)"
                )
                if ok:
                    advanced += 1

        # Refresh stats after movements
        stats = await asyncio.to_thread(self.pipeline_db.get_pipeline_stats)

        # Embed stats in current_task so frontend can use them
        self.current_task = {
            "type": "pipeline-status",
            "pipeline_stats": stats["stage_counts"],
        }

        # Every 5th tick, generate a detailed report
        if self.tick_count % 5 == 0 and stats["total_leads"] > 0:
            await self._generate_report(stats)

        self.tasks_completed += 1
        sc = stats["stage_counts"]
        total = stats["total_leads"]
        closed = sc.get("closed", 0)
        rate = f"{stats['conversion_rate']*100:.1f}%"

        return self.emit(
            "completed",
            f"Pipeline: {total} leads, {advanced} advanced, {closed} closed ({rate} conv)"
        )

    async def _generate_report(self, stats: dict):
        """Generate a pipeline analysis report via LLM."""
        try:
            prompt = f"""Analyze this sales pipeline and provide strategic insights.

Pipeline Stats:
- Total Leads: {stats['total_leads']}
- Stage Breakdown: {json.dumps(stats['stage_counts'])}
- Industries: {json.dumps(stats['industries'])}
- Outreach Messages Drafted: {stats['outreach_drafted']}
- Overall Conversion Rate: {stats['conversion_rate']*100:.1f}%

Provide a JSON report:
- "summary": 2-3 sentence executive summary
- "bottlenecks": Array of identified bottlenecks in the pipeline
- "top_industries": Array of best-performing industries with reasoning
- "recommendations": Array of 3-4 actionable recommendations
- "health_score": Pipeline health score 0-100 with reasoning

Return ONLY valid JSON."""

            system = "You are a sales operations analyst. Provide data-driven pipeline insights. Output only valid JSON."
            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            save_output(result, "pipeline-reports", "pipeline-report", fmt="json")
        except Exception:
            pass  # Report generation is best-effort

    def get_tools(self) -> list[dict]:
        return []
