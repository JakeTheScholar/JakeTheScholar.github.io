"""Gumroad Product Agent — packages digital products for Gumroad listings."""

import sys
import json
import asyncio
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir


# Product types to create and list on Gumroad
PRODUCT_BLUEPRINTS = [
    {
        "id": "trading-journal-bundle",
        "title": "Ultimate Trading Journal Bundle",
        "type": "template-pack",
        "price_range": "$9-19",
        "description_hint": "Complete set of trading journals — daily, weekly, monthly review templates",
        "tags": ["trading", "journal", "finance", "day trading", "futures"],
        "includes": ["4 journal templates", "performance tracker", "trade log", "monthly review"],
    },
    {
        "id": "budget-planner-kit",
        "title": "Financial Planner Kit",
        "type": "template-pack",
        "price_range": "$7-15",
        "description_hint": "Budget tracker, expense log, savings goals, debt payoff — all in one download",
        "tags": ["budget", "planner", "finance", "savings", "printable"],
        "includes": ["monthly budget", "expense tracker", "savings goals", "debt payoff tracker"],
    },
    {
        "id": "ai-prompt-pack-finance",
        "title": "AI Prompt Pack: Finance & Trading",
        "type": "prompt-pack",
        "price_range": "$5-12",
        "description_hint": "100+ ChatGPT/Claude prompts for traders, investors, and finance professionals",
        "tags": ["AI prompts", "ChatGPT", "finance", "trading", "productivity"],
        "includes": ["trading analysis prompts", "portfolio review prompts", "market research prompts", "risk management prompts"],
    },
    {
        "id": "ai-prompt-pack-business",
        "title": "AI Prompt Pack: Business Automation",
        "type": "prompt-pack",
        "price_range": "$7-15",
        "description_hint": "200+ prompts for automating business workflows with AI",
        "tags": ["AI prompts", "business", "automation", "productivity", "ChatGPT"],
        "includes": ["email templates", "content creation", "data analysis", "customer service", "marketing"],
    },
    {
        "id": "notion-trading-dashboard",
        "title": "Notion Trading Dashboard",
        "type": "notion-template",
        "price_range": "$12-25",
        "description_hint": "Complete Notion workspace for traders — journal, watchlist, performance analytics",
        "tags": ["Notion", "trading", "dashboard", "productivity", "template"],
        "includes": ["trade journal database", "watchlist tracker", "performance charts", "weekly review"],
    },
    {
        "id": "side-hustle-starter-kit",
        "title": "AI Side Hustle Starter Kit",
        "type": "guide-bundle",
        "price_range": "$15-29",
        "description_hint": "Step-by-step guide to starting an AI automation business + templates",
        "tags": ["side hustle", "AI", "automation", "business", "freelance"],
        "includes": ["setup guide", "client outreach templates", "pricing calculator", "portfolio template", "proposal template"],
    },
    {
        "id": "etsy-seller-toolkit",
        "title": "Etsy Digital Product Seller Toolkit",
        "type": "guide-bundle",
        "price_range": "$12-19",
        "description_hint": "Everything you need to start selling digital products on Etsy",
        "tags": ["Etsy", "digital products", "passive income", "printables", "side hustle"],
        "includes": ["listing optimization guide", "SEO keyword list", "mockup templates", "pricing strategy"],
    },
    {
        "id": "portfolio-tracker-pro",
        "title": "Investment Portfolio Tracker Pro",
        "type": "spreadsheet",
        "price_range": "$9-19",
        "description_hint": "Professional Google Sheets / Excel portfolio tracker with auto-calculations",
        "tags": ["investing", "portfolio", "spreadsheet", "stocks", "finance"],
        "includes": ["holdings tracker", "asset allocation chart", "dividend tracker", "rebalancing calculator"],
    },
    {
        "id": "claude-code-skills-pack",
        "title": "Claude Code Power User Skills Pack",
        "type": "developer-tools",
        "price_range": "$10-25",
        "description_hint": "Custom Claude Code skills for developers — automation, deployment, testing",
        "tags": ["Claude Code", "developer tools", "AI coding", "automation", "productivity"],
        "includes": ["10+ custom skills", "installation guide", "customization tips", "workflow examples"],
    },
    {
        "id": "net-worth-tracker",
        "title": "Net Worth & Financial Freedom Tracker",
        "type": "spreadsheet",
        "price_range": "$7-12",
        "description_hint": "Track your net worth monthly, visualize your path to financial independence",
        "tags": ["net worth", "FIRE", "financial freedom", "tracker", "spreadsheet"],
        "includes": ["net worth dashboard", "monthly tracker", "goal timeline", "milestone celebrations"],
    },
]

LISTING_PROMPT = """Create a compelling Gumroad product listing for:

Product: {title}
Type: {product_type}
Price Range: {price_range}
Description hint: {description_hint}
Included items: {includes}
Tags: {tags}

Generate a complete listing with:
- name: catchy product name (can refine the provided title)
- tagline: one-line hook (under 60 chars)
- description: compelling 150-250 word product description with bullet points and social proof language
- price: specific price in cents (e.g. 900 for $9.00) — pick the sweet spot
- features: JSON array of 4-6 key feature bullet points
- faq: JSON array of 3 common Q&A pairs
- cover_image_prompt: Stable Diffusion prompt for the product cover image
- thumbnail_prompt: shorter prompt for the thumbnail/preview

Output ONLY valid JSON. No explanation."""


class GumroadAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="gumroad-001",
            name="Gumroad Packager",
            description="Creates product listings, descriptions & mockups for Gumroad store",
            color="#ff90e8",
        )
        self.tick_interval = 90
        self.pipeline_db = None
        self.index = 0

    async def tick(self) -> AgentEvent:
        blueprint = PRODUCT_BLUEPRINTS[self.index % len(PRODUCT_BLUEPRINTS)]

        self.current_task = {
            "type": "gumroad-listing",
            "description": f"Creating listing: {blueprint['title']}",
        }

        self.emit("packaging", f"Building Gumroad listing: {blueprint['title']}")

        try:
            prompt = LISTING_PROMPT.format(
                title=blueprint["title"],
                product_type=blueprint["type"],
                price_range=blueprint["price_range"],
                description_hint=blueprint["description_hint"],
                includes=", ".join(blueprint["includes"]),
                tags=", ".join(blueprint["tags"]),
            )

            system = (
                "You are a digital product marketing expert who writes high-converting "
                "Gumroad listings. You understand pricing psychology, social proof, and "
                "what makes people click 'buy'. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                listing_data = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON for {blueprint['title']}")

            # Merge blueprint metadata
            listing_data["product_id"] = blueprint["id"]
            listing_data["product_type"] = blueprint["type"]
            listing_data["blueprint_tags"] = blueprint["tags"]
            listing_data["includes"] = blueprint["includes"]

            # Save listing
            out_dir = ensure_output_dir("gumroad-listings")
            filename = f"{blueprint['id']}-{self.tasks_completed:04d}.json"
            filepath = out_dir / filename
            filepath.write_text(json.dumps(listing_data, indent=2), encoding="utf-8")

            # Track in Gumroad pipeline
            if self.pipeline_db:
                try:
                    price = listing_data.get("price", 0)
                    price_display = f"${price/100:.2f}" if isinstance(price, int) else str(price)
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "gumroad",
                        listing_data.get("name", blueprint["title"]),
                        subtitle=f"{blueprint['type']} — {price_display}",
                        stage="drafted",
                        score=random.randint(55, 90),
                        metadata={
                            "listing_file": filename,
                            "product_type": blueprint["type"],
                            "price": price,
                            "product_id": blueprint["id"],
                        },
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Listed: {blueprint['title']} → {filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Listing failed for {blueprint['title']}: {e}")

    def get_tools(self) -> list[dict]:
        return []
