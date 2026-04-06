"""Ad Copy Agent — generates paid ad copy for products and services."""

import sys
import asyncio
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


AD_PLATFORMS = ["facebook", "instagram", "google"]

PRODUCTS = [
    {"name": "Trading Journal Template", "type": "printable", "price": "$4.99", "audience": "day traders, swing traders"},
    {"name": "Budget Planner Bundle", "type": "printable", "price": "$6.99", "audience": "young professionals, couples"},
    {"name": "Expense Tracker Spreadsheet", "type": "printable", "price": "$3.99", "audience": "freelancers, small business owners"},
    {"name": "Net Worth Calculator", "type": "printable", "price": "$4.99", "audience": "millennials, FIRE community"},
    {"name": "Debt Payoff Planner", "type": "printable", "price": "$3.99", "audience": "people in debt, Dave Ramsey followers"},
    {"name": "Custom Financial Dashboard", "type": "fiverr-gig", "price": "$25-75", "audience": "small business owners, startups"},
    {"name": "Lo-Fi Study Beats Pack", "type": "audio", "price": "$9.99", "audience": "students, content creators"},
    {"name": "Podcast Intro Music Pack", "type": "audio", "price": "$14.99", "audience": "podcasters, YouTubers"},
]

AD_PROMPT = """Create {count} ad variations for {platform} advertising.

Product: {product_name}
Type: {product_type}
Price: {price}
Target audience: {audience}

Return a JSON object:
- "platform": "{platform}"
- "product": "{product_name}"
- "campaign_objective": Best campaign objective for this product
- "target_audience": Detailed targeting (demographics, interests, behaviors)
- "ads": Array of {count} ad variations, each with:
  - "variant": "A", "B", or "C"
  - "headline": Primary headline (under 40 chars for FB/IG, under 30 for Google)
  - "description": Ad description/body text (platform-appropriate length)
  - "cta_button": CTA button text
  - "hook": The scroll-stopping first line
  - "visual_suggestion": What the ad image/video should show
  - "estimated_ctr": Estimated CTR range based on industry benchmarks
- "budget_suggestion": Recommended daily budget for testing
- "testing_strategy": How to A/B test these variants (2-3 sentences)
- "retargeting_copy": A retargeting ad for people who clicked but didn't buy

Return ONLY valid JSON."""


class AdCopyAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="ad-copy-001",
            name="Ad Copy Agent",
            description="Paid ad copy & A/B variants",
            color="#3b82f6",
        )
        self.tick_interval = 140
        self.pipeline_db = None
        self.product_index = 0
        self.platform_index = 0

    async def tick(self) -> AgentEvent:
        product = PRODUCTS[self.product_index % len(PRODUCTS)]
        platform = AD_PLATFORMS[self.platform_index % len(AD_PLATFORMS)]

        self.current_task = {
            "type": "ad-copy",
            "description": f"Creating {platform} ads for {product['name']}",
        }

        self.emit("generating", f"Writing {platform} ads for {product['name']}")

        try:
            count = 3 if platform != "google" else 2
            prompt = AD_PROMPT.format(
                count=count,
                platform=platform,
                product_name=product["name"],
                product_type=product["type"],
                price=product["price"],
                audience=product["audience"],
            )
            system = (
                "You are a performance marketing expert who writes high-converting ad copy. "
                "You know platform best practices for Facebook, Instagram, and Google Ads. "
                "Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = product["name"].lower().replace(" ", "-")[:25]
            save_result = save_template(result, f"ad-{platform}-{slug}", fmt="json")

            # Track in content pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "content", f"{platform.title()} Ads: {product['name']}",
                        subtitle=platform,
                        stage="created", score=random.randint(55, 75),
                        metadata={
                            "platform": platform,
                            "product": product["name"],
                            "product_type": product["type"],
                            "filename": save_result["filename"],
                        },
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.platform_index += 1
            if self.platform_index % len(AD_PLATFORMS) == 0:
                self.product_index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"{platform} ads for '{product['name']}' → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Ad copy failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
