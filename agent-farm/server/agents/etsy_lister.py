"""Etsy Lister Agent — generates optimized Etsy listing copy and tags."""

import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


LISTING_TYPES = [
    # Finance printables
    {"id": "trading-journal", "niche": "printable"},
    {"id": "budget-planner", "niche": "printable"},
    {"id": "expense-tracker", "niche": "printable"},
    {"id": "portfolio-tracker", "niche": "printable"},
    {"id": "net-worth-worksheet", "niche": "printable"},
    {"id": "goal-planner", "niche": "printable"},
    {"id": "debt-payoff-tracker", "niche": "printable"},
    {"id": "income-log", "niche": "printable"},
    {"id": "habit-tracker", "niche": "printable"},
    {"id": "monthly-review", "niche": "printable"},
    # Clothing / POD
    {"id": "finance-hustle-tshirt", "niche": "clothing"},
    {"id": "trader-lifestyle-tee", "niche": "clothing"},
    {"id": "crypto-culture-tee", "niche": "clothing"},
    {"id": "motivational-grind-hoodie", "niche": "clothing"},
    {"id": "gym-finance-tee", "niche": "clothing"},
    {"id": "finance-tote-bag", "niche": "clothing"},
    {"id": "trader-morning-mug", "niche": "clothing"},
    {"id": "streetwear-finance-hoodie", "niche": "clothing"},
]

PRINTABLE_PROMPT = """Create an optimized Etsy listing for a printable "{product}" template.

Return a JSON object with these fields:
- "title": Etsy title (max 140 chars, keyword-rich, include "Printable", "PDF", "Digital Download")
- "description": Full Etsy description (500-800 words). Include: what's included, how to use, print instructions, benefits. Use line breaks for readability.
- "tags": Array of 13 Etsy tags (max 20 chars each, long-tail keywords)
- "categories": Suggested Etsy category path
- "price_suggestion": Suggested price in USD (based on market for digital printables)

Target audience: people interested in personal finance, budgeting, trading, and wealth building.
Tone: professional but approachable.

Return ONLY valid JSON, no explanation."""

CLOTHING_PROMPT = """Create an optimized Etsy listing for a print-on-demand "{product}" design.

Return a JSON object with these fields:
- "title": Etsy title (max 140 chars, keyword-rich, include garment type and style descriptors)
- "description": Full Etsy description (500-800 words). Include: design details, available sizes (S-3XL), material info (cotton blend), print quality (DTG/sublimation), care instructions, shipping note (made to order, 3-5 business days). Use line breaks for readability.
- "tags": Array of 13 Etsy tags (max 20 chars each, long-tail keywords for clothing)
- "categories": Suggested Etsy category path
- "price_suggestion": Suggested price in USD (based on POD market — typically $22-35 for tees, $35-55 for hoodies)
- "sizes": Array of available sizes
- "colors": Array of 3-5 recommended base garment colors for this design

Target audience: finance bros, traders, crypto enthusiasts, entrepreneurs, hustle culture.
Tone: streetwear meets Wall Street — confident, bold, aspirational.

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
        listing = LISTING_TYPES[self.queue_index % len(LISTING_TYPES)]
        product = listing["id"]
        niche = listing["niche"]
        display_name = product.replace("-", " ").title()

        self.current_task = {
            "type": "etsy-listing",
            "description": f"Creating Etsy listing for {display_name}",
        }

        self.emit("generating", f"Writing Etsy listing for {display_name}")

        try:
            if niche == "clothing":
                prompt = CLOTHING_PROMPT.format(product=display_name)
                system = (
                    "You are an Etsy SEO expert specializing in print-on-demand clothing and accessories. "
                    "You write high-converting listing copy for streetwear and lifestyle apparel. "
                    "Output only valid JSON."
                )
            else:
                prompt = PRINTABLE_PROMPT.format(product=display_name)
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
