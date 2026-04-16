"""COO Agent — chief operating officer, monitors operational efficiency,
agent throughput, uptime, and workflow bottlenecks.

Runs every 150 seconds.
"""

import sys
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


class COOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="coo-001",
            name="COO",
            description="Operations management — throughput, uptime, workflow optimization",
            color="#ff6e40",
        )
        self.tick_interval = 150
        self.orchestrator = None
        self.pipeline_db = None
        self._prev_task_counts: dict[str, int] = {}

    async def tick(self) -> AgentEvent:
        if not self.orchestrator:
            return self.emit("idle", "Awaiting orchestrator link")

        self.current_task = {
            "type": "ops_report",
            "description": "Analyzing operational throughput",
        }

        agents = self.orchestrator.agents
        total = 0
        running = 0
        idle = 0
        errored = 0
        paused = 0
        throughput_delta = 0
        top_performers = []
        errored_names: list[str] = []     # call out specific broken agents
        stalled_names: list[str] = []     # running but no progress in >3 ticks

        for aid, agent in agents.items():
            if aid in ("ceo-001", "cfo-001", "coo-001", "cmo-001", "cto-001", "cco-001"):
                continue  # Skip executive agents from ops count

            total += 1
            if agent.status == "running":
                running += 1
            elif agent.status == "idle":
                idle += 1
            elif agent.status == "error":
                errored += 1
                errored_names.append(agent.name)
            elif agent.status == "paused":
                paused += 1

            # Calculate throughput delta since last tick
            prev = self._prev_task_counts.get(aid, 0)
            delta = agent.tasks_completed - prev
            throughput_delta += delta
            self._prev_task_counts[aid] = agent.tasks_completed

            if delta > 0:
                top_performers.append((agent.name, delta))

            # Stall heuristic: running agent with zero delta across 3+ COO ticks
            # (COO tick = 150s, so 7.5min without progress is suspicious).
            if agent.status == "running" and delta == 0:
                strikes = getattr(agent, "_coo_stall_strikes", 0) + 1
                agent._coo_stall_strikes = strikes
                if strikes >= 3:
                    stalled_names.append(agent.name)
            else:
                if hasattr(agent, "_coo_stall_strikes"):
                    agent._coo_stall_strikes = 0

        # Sort by tasks completed this tick
        top_performers.sort(key=lambda x: x[1], reverse=True)
        top_str = ", ".join(f"{name}(+{d})" for name, d in top_performers[:3])

        uptime_pct = f"{(running / total * 100):.0f}%" if total > 0 else "N/A"

        parts = [
            f"Ops: {running}/{total} running ({uptime_pct} uptime)",
            f"+{throughput_delta} tasks this cycle",
        ]
        if errored_names:
            parts.append(f"ERRORS: {', '.join(errored_names[:3])}")
        elif errored:
            parts.append(f"{errored} in error state")
        if stalled_names:
            parts.append(f"STALLED: {', '.join(stalled_names[:3])}")
        if paused:
            parts.append(f"{paused} paused")
        if top_str:
            parts.append(f"Top: {top_str}")

        # Mockup pitch flow depth — flags pipeline bottlenecks in the no-website track
        if self.pipeline_db:
            try:
                no_site_scraped = await asyncio.to_thread(
                    self.pipeline_db.get_leads_by_stage, "scraped", 100
                )
                queued = sum(1 for l in no_site_scraped if not l.get("website"))
                pitch_ready = await asyncio.to_thread(
                    self.pipeline_db.get_leads_by_stage, "pitch_ready", 100
                )
                drafts_pending = await asyncio.to_thread(
                    self.pipeline_db.count_outreach_by_status, "mockup_email",
                    ["gmail_draft", "gmail_draft_manual"]
                )
                if queued or pitch_ready or drafts_pending:
                    parts.append(
                        f"Mockup flow: {queued} queued → {len(pitch_ready)} pitch-ready → {drafts_pending} drafts"
                    )
            except Exception:
                pass

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("ops_report", " | ".join(parts))

    def get_tools(self) -> list[dict]:
        return []
