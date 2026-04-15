"""Content Scheduler Agent — creates cross-platform content calendars and posting schedules."""

import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


SCHEDULE_TYPES = [
    {"period": "weekly", "focus": "Instagram + TikTok content calendar"},
    {"period": "weekly", "focus": "Pinterest pin scheduling strategy"},
    {"period": "monthly", "focus": "Full content calendar across all platforms"},
    {"period": "launch", "focus": "New product launch campaign (7-day)"},
    {"period": "seasonal", "focus": "Seasonal promotion calendar (tax season, new year, back to school)"},
    {"period": "weekly", "focus": "Email newsletter content plan"},
    {"period": "monthly", "focus": "Blog/SEO content calendar for organic traffic"},
    {"period": "weekly", "focus": "Twitter/X engagement strategy schedule"},
]

SCHEDULE_PROMPT = """Create a {period} content schedule focused on: {focus}

Context: Digital printables business selling financial templates (trading journals, budget planners, expense trackers) on Etsy and Fiverr.

Return a JSON object:
- "schedule_type": "{period}"
- "focus": "{focus}"
- "overview": 2-3 sentence strategy summary
- "calendar": Array of day objects, each with:
  - "day": Day name or date
  - "posts": Array of post objects with:
    - "platform": Which platform
    - "time": Best posting time
    - "content_type": "image" | "carousel" | "reel" | "story" | "pin" | "thread" | "email"
    - "topic": What to post about
    - "caption_hook": First line / hook
    - "product_tie_in": Which product to promote (if any)
- "recurring_themes": Array of weekly content themes/pillars
- "best_practices": Array of 3-4 platform-specific tips
- "metrics_to_track": Array of KPIs for this schedule

Return ONLY valid JSON."""


class SchedulerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="scheduler-001",
            name="Content Scheduler",
            description="Cross-platform scheduling",
            color="#e879f9",
        )
        self.tick_interval = 200
        self.pipeline_db = None
        self.index = 0

    async def tick(self) -> AgentEvent:
        task = SCHEDULE_TYPES[self.index % len(SCHEDULE_TYPES)]
        focus = task["focus"]

        self.current_task = {
            "type": "content-schedule",
            "description": f"Creating {task['period']} schedule: {focus}",
        }

        self.emit("scheduling", f"Building {task['period']} plan: {focus}")

        try:
            prompt = SCHEDULE_PROMPT.format(period=task["period"], focus=focus)
            system = (
                "You are a content marketing strategist for e-commerce brands. "
                "You create detailed, actionable content calendars. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = focus.lower().replace(" ", "-")[:30]
            save_result = save_output(result, "schedules", f"schedule-{task['period']}-{slug}", fmt="json")

            # Track in Content pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "content", f"{task['period'].title()} Schedule: {focus[:40]}",
                        subtitle=task["period"],
                        stage="scheduled", score=60,
                        metadata={"period": task["period"], "filename": save_result["filename"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"{task['period']} schedule: {focus} → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
