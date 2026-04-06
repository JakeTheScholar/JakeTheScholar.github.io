"""Fiverr Gig Agent — generates Fiverr gig descriptions and packages."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


GIG_TYPES = [
    {"service": "Custom Budget Spreadsheet", "category": "Financial Consulting"},
    {"service": "Trading Journal Template", "category": "Data Entry & Spreadsheets"},
    {"service": "Business Financial Dashboard", "category": "Financial Consulting"},
    {"service": "Debt Payoff Planner", "category": "Financial Consulting"},
    {"service": "Investment Portfolio Tracker", "category": "Data Entry & Spreadsheets"},
    {"service": "Monthly Budget Planner", "category": "Financial Consulting"},
    {"service": "Expense Report Template", "category": "Data Entry & Spreadsheets"},
    {"service": "Revenue Forecasting Model", "category": "Financial Consulting"},
]

GIG_PROMPT = """Create a Fiverr gig listing for: "{service}"
Category: {category}

Return a JSON object:
- "title": Fiverr gig title (start with "I will", max 80 chars)
- "description": Full gig description (300-500 words). Professional, highlight deliverables and expertise.
- "search_tags": Array of 5 Fiverr search tags
- "packages": Object with "basic", "standard", "premium" keys, each having:
  - "name": Package name
  - "description": What's included (1-2 sentences)
  - "price": Price in USD
  - "delivery_days": Delivery time
  - "revisions": Number of revisions
- "faq": Array of 3 FAQ objects with "question" and "answer"
- "requirements": Array of 3 things to ask the buyer before starting

Return ONLY valid JSON."""


class FiverrAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="fiverr-001",
            name="Fiverr Gigs",
            description="Gig management & delivery",
            color="#8b5cf6",
        )
        self.tick_interval = 120
        self.index = 0

    async def tick(self) -> AgentEvent:
        gig = GIG_TYPES[self.index % len(GIG_TYPES)]
        service = gig["service"]

        self.current_task = {
            "type": "fiverr-gig",
            "description": f"Creating Fiverr gig: {service}",
        }

        self.emit("generating", f"Writing Fiverr gig for {service}")

        try:
            prompt = GIG_PROMPT.format(service=service, category=gig["category"])
            system = (
                "You are a top-rated Fiverr seller specializing in financial templates and spreadsheets. "
                "You write compelling gig descriptions that convert. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = service.lower().replace(" ", "-")
            save_result = save_template(result, f"fiverr-{slug}", fmt="json")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Fiverr gig '{service}' → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
