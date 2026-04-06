"""Etsy Lister Agent — generates optimized Etsy listing copy and tags."""

import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


LISTING_TYPES = [
    "trading-journal", "budget-planner", "expense-tracker", "portfolio-tracker",
    "net-worth-worksheet", "goal-planner", "debt-payoff-tracker", "income-log",
    "habit-tracker", "monthly-review",
]

LISTING_PROMPT = """Create an optimized Etsy listing for a printable "{product}" template.

Return a JSON object with these fields:
- "title": Etsy title (max 140 chars, keyword-rich, include "Printable", "PDF", "Digital Download")
- "description": Full Etsy description (500-800 words). Include: what's included, how to use, print instructions, benefits. Use line breaks for readability.
- "tags": Array of 13 Etsy tags (max 20 chars each, long-tail keywords)
- "categories": Suggested Etsy category path
- "price_suggestion": Suggested price in USD (based on market for digital printables)

Target audience: people interested in personal finance, budgeting, trading, and wealth building.
Tone: professional but approachable.

Return ONLY valid JSON, no explanation."""


class EtsyListerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="etsy-lister-001",
            name="Etsy Lister",
            description="Listing copy & SEO optimization",
            color="#39ff14",
        )
        self.tick_interval = 90
        self.pipeline_db = None
        self.queue_index = 0

    async def tick(self) -> AgentEvent:
        product = LISTING_TYPES[self.queue_index % len(LISTING_TYPES)]
        display_name = product.replace("-", " ").title()

        self.current_task = {
            "type": "etsy-listing",
            "description": f"Creating Etsy listing for {display_name}",
        }

        self.emit("generating", f"Writing Etsy listing for {display_name}")

        try:
            prompt = LISTING_PROMPT.format(product=display_name)
            system = (
                "You are an Etsy SEO expert specializing in digital printable products. "
                "You write high-converting listing copy with strong keywords. "
                "Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            save_result = save_template(result, f"etsy-listing-{product}", fmt="json")

            # Track in Etsy pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "etsy", f"{display_name} Listing",
                        subtitle=product,
                        stage="listed", score=65,
                        metadata={"filename": save_result["filename"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.queue_index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Etsy listing for {display_name} → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
