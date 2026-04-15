"""CCO Agent — chief content officer, oversees content quality, publishing
schedule, brand consistency across printables, social, and video.

Runs every 160 seconds.
"""

import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent


# Agents under content oversight
CONTENT_AGENTS = [
    "printables-001", "etsy-lister-001", "social-001",
    "thumbnail-001", "scheduler-001", "faceless-content-001", "video-producer-001",
]


class CCOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="cco-001",
            name="CCO",
            description="Content strategy — quality control, publishing calendar, brand voice",
            color="#ff4081",
        )
        self.tick_interval = 160
        self.orchestrator = None
        self.pipeline_db = None

    async def tick(self) -> AgentEvent:
        self.current_task = {
            "type": "content_report",
            "description": "Reviewing content pipeline and quality",
        }

        self.emit("reviewing", "Auditing content output and publishing schedule")

        parts = []

        # Content team status
        if self.orchestrator:
            agents = self.orchestrator.agents
            active = 0
            total_content_tasks = 0
            for aid in CONTENT_AGENTS:
                agent = agents.get(aid)
                if agent:
                    total_content_tasks += agent.tasks_completed
                    if agent.status == "running":
                        active += 1
            parts.append(f"Content team: {active}/{len(CONTENT_AGENTS)} active, {total_content_tasks} pieces produced")

        # Count output files by type
        output_dir = Path(__file__).parent.parent / "output"
        if output_dir.exists():
            counts = {}
            for subdir in output_dir.iterdir():
                if subdir.is_dir():
                    file_count = sum(1 for f in subdir.iterdir() if f.is_file() and not f.name.startswith("."))
                    if file_count > 0:
                        counts[subdir.name] = file_count

            if counts:
                breakdown = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1])[:5])
                parts.append(f"Output: {breakdown}")

        # Pipeline content stats
        if self.pipeline_db:
            try:
                all_stats = await asyncio.to_thread(self.pipeline_db.get_all_pipeline_stats)

                etsy = all_stats.get("etsy", {}).get("total", 0)
                content = all_stats.get("content", {}).get("total", 0)
                audio = all_stats.get("audio", {}).get("total", 0)

                pipeline_parts = []
                if etsy:
                    pipeline_parts.append(f"Etsy: {etsy}")
                if content:
                    pipeline_parts.append(f"Content: {content}")
                if audio:
                    pipeline_parts.append(f"Audio: {audio}")
                if pipeline_parts:
                    parts.append(f"Pipelines: {', '.join(pipeline_parts)}")
            except Exception:
                pass

        if not parts:
            parts.append("Content systems initializing — building publishing calendar")

        self.tasks_completed += 1
        self.current_task = None
        return self.emit("content_report", " | ".join(parts))

    def get_tools(self) -> list[dict]:
        return []
