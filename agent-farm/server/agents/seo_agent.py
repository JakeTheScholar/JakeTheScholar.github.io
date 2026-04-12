"""SEO Agent — keyword research and optimization for Etsy and web."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


SEO_TASKS = [
    # Finance printables
    {"niche": "trading journal printable", "platform": "etsy"},
    {"niche": "budget planner template", "platform": "etsy"},
    {"niche": "expense tracker spreadsheet", "platform": "etsy"},
    {"niche": "financial planner digital download", "platform": "etsy"},
    {"niche": "investment portfolio tracker", "platform": "etsy"},
    {"niche": "debt payoff planner", "platform": "etsy"},
    {"niche": "personal finance template", "platform": "google"},
    {"niche": "money management printable", "platform": "pinterest"},
    # Clothing / POD
    {"niche": "finance bro t-shirt", "platform": "etsy"},
    {"niche": "trader lifestyle clothing", "platform": "etsy"},
    {"niche": "crypto streetwear hoodie", "platform": "etsy"},
    {"niche": "motivational hustle tee", "platform": "etsy"},
    {"niche": "stock market graphic tee", "platform": "etsy"},
    {"niche": "entrepreneur apparel print on demand", "platform": "google"},
    {"niche": "finance gym crossover shirt", "platform": "etsy"},
]

SEO_PROMPT = """Perform keyword research for the niche "{niche}" on {platform}.

Return a JSON object:
- "niche": "{niche}"
- "platform": "{platform}"
- "primary_keywords": Array of 5 high-volume primary keywords with estimated competition (low/medium/high)
- "long_tail_keywords": Array of 15 long-tail keyword phrases (3-5 words each)
- "trending_terms": Array of 5 currently trending related terms
- "title_formulas": Array of 5 optimized title templates using these keywords
- "tag_sets": Array of 3 different tag combination sets (13 tags each for Etsy)
- "competitor_keywords": Array of 5 keywords competitors likely target
- "content_gaps": Array of 3 keyword opportunities competitors are missing
- "seasonal_notes": Any seasonal trends for this niche

Return ONLY valid JSON."""


class SEOAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="seo-001",
            name="SEO Agent",
            description="Keyword research & optimization",
            color="#34d399",
        )
        self.tick_interval = 120
        self.index = 0

    async def tick(self) -> AgentEvent:
        task = SEO_TASKS[self.index % len(SEO_TASKS)]
        niche = task["niche"]
        platform = task["platform"]

        self.current_task = {
            "type": "seo-research",
            "description": f"SEO research: {niche} on {platform}",
        }

        self.emit("researching", f"Keyword research: {niche} ({platform})")

        try:
            prompt = SEO_PROMPT.format(niche=niche, platform=platform)
            system = (
                "You are an SEO specialist for e-commerce and digital products. "
                "You identify high-value keywords and optimization strategies. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = niche.replace(" ", "-")[:30]
            save_result = save_template(result, f"seo-{slug}-{platform}", fmt="json")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"SEO report: {niche} ({platform}) → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
