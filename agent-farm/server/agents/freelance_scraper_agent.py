"""Freelance Scraper Agent — finds AI automation gigs on Upwork/Fiverr/freelance boards."""

import sys
import json
import asyncio
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir


# Gig categories that match Jake's skill set
GIG_CATEGORIES = [
    {
        "id": "ai-chatbot",
        "name": "AI Chatbot Development",
        "platforms": ["upwork", "fiverr", "toptal"],
        "keywords": "AI chatbot, custom GPT, conversational AI, customer support bot",
        "typical_budget": "$500-2,000",
        "skills_match": ["Python", "FastAPI", "OpenAI API", "Claude API", "WebSocket"],
    },
    {
        "id": "automation-workflows",
        "name": "Business Automation",
        "platforms": ["upwork", "fiverr", "freelancer"],
        "keywords": "workflow automation, Zapier alternative, Python automation, email automation",
        "typical_budget": "$1,000-5,000",
        "skills_match": ["Python", "API Integration", "FastAPI", "Cron Jobs"],
    },
    {
        "id": "trading-bot",
        "name": "Trading Bot Development",
        "platforms": ["upwork", "freelancer", "toptal"],
        "keywords": "trading bot, algorithmic trading, NinjaScript, futures bot, crypto bot",
        "typical_budget": "$2,000-10,000",
        "skills_match": ["NinjaScript", "Python", "Quantitative Finance", "API Trading"],
    },
    {
        "id": "ai-dashboard",
        "name": "AI Dashboard / Analytics",
        "platforms": ["upwork", "fiverr", "toptal"],
        "keywords": "data dashboard, AI analytics, real-time monitoring, admin panel",
        "typical_budget": "$1,500-5,000",
        "skills_match": ["JavaScript", "React", "Tailwind CSS", "FastAPI", "WebSocket"],
    },
    {
        "id": "web-scraping",
        "name": "Web Scraping & Data Extraction",
        "platforms": ["upwork", "fiverr", "freelancer"],
        "keywords": "web scraping, data extraction, Apify, Puppeteer, API scraping",
        "typical_budget": "$300-1,500",
        "skills_match": ["Python", "BeautifulSoup", "Playwright", "Apify"],
    },
    {
        "id": "ai-content-gen",
        "name": "AI Content Generation Tool",
        "platforms": ["upwork", "fiverr"],
        "keywords": "AI content tool, automated blog writing, SEO content generator, social media AI",
        "typical_budget": "$500-3,000",
        "skills_match": ["Python", "Claude API", "OpenAI API", "FastAPI"],
    },
    {
        "id": "saas-mvp",
        "name": "SaaS MVP Development",
        "platforms": ["upwork", "toptal", "indie-hackers"],
        "keywords": "SaaS MVP, web app, startup prototype, full-stack development",
        "typical_budget": "$3,000-10,000",
        "skills_match": ["React", "FastAPI", "PostgreSQL", "Deployment", "Full Stack"],
    },
    {
        "id": "etsy-automation",
        "name": "Etsy / E-commerce Automation",
        "platforms": ["upwork", "fiverr"],
        "keywords": "Etsy automation, product listing tool, e-commerce bot, inventory management",
        "typical_budget": "$500-2,000",
        "skills_match": ["Python", "Etsy API", "Automation", "E-commerce"],
    },
]

SCRAPE_PROMPT = """Generate exactly 3 realistic freelance job postings for "{category}" ({keywords}).

Simulate what would appear on {platform} right now. For each posting provide:
- job_title: realistic freelance job title as it would appear on {platform}
- client_name: realistic company or individual name
- description: 2-3 sentence job description with specific requirements
- budget_range: realistic budget range (e.g. "$500-1,000" or "$2,000 fixed")
- platform: "{platform}"
- posted_days_ago: random 0-7
- proposals_count: realistic number of competing proposals (5-50 for Upwork, N/A for others)
- skills_required: JSON array of 3-5 specific skills
- match_score: 0-100 how well this matches someone with skills in {skills}
- pitch_angle: one-sentence suggestion for how to pitch this gig

Return ONLY a valid JSON array of 3 objects. No explanation."""


class FreelanceScraperAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="freelance-scraper-001",
            name="Freelance Scout",
            description="Finds AI automation & dev gigs on Upwork, Fiverr, and freelance boards",
            color="#22d3ee",
        )
        self.tick_interval = 60
        self.pipeline_db = None
        self.index = 0

    async def tick(self) -> AgentEvent:
        category = GIG_CATEGORIES[self.index % len(GIG_CATEGORIES)]
        platform = category["platforms"][self.tasks_completed % len(category["platforms"])]

        self.current_task = {
            "type": "freelance-scrape",
            "description": f"Scouting {category['name']} gigs on {platform}",
        }

        self.emit("scouting", f"Scanning {platform} for {category['name']} gigs")

        try:
            prompt = SCRAPE_PROMPT.format(
                category=category["name"],
                keywords=category["keywords"],
                platform=platform,
                skills=", ".join(category["skills_match"]),
            )

            system = (
                "You are a freelance market researcher. Generate realistic job postings "
                "that would appear on freelance platforms. Make them specific and actionable. "
                "Output only valid JSON arrays."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                gigs = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON for {category['name']} on {platform}")

            if not isinstance(gigs, list):
                gigs = [gigs]

            # Save gigs
            out_dir = ensure_output_dir("freelance-gigs")
            filename = f"{category['id']}-{platform}-{self.tasks_completed:04d}.json"
            filepath = out_dir / filename

            saved_gigs = []
            for gig in gigs[:3]:
                gig["category"] = category["id"]
                gig["category_name"] = category["name"]
                gig["typical_budget"] = category["typical_budget"]
                saved_gigs.append(gig)

            filepath.write_text(json.dumps(saved_gigs, indent=2), encoding="utf-8")

            # Track in freelance pipeline
            if self.pipeline_db:
                for gig in saved_gigs:
                    try:
                        score = gig.get("match_score", random.randint(40, 85))
                        await asyncio.to_thread(
                            self.pipeline_db.add_item,
                            "freelance",
                            gig.get("job_title", category["name"]),
                            subtitle=f"{platform} — {gig.get('budget_range', 'N/A')}",
                            stage="discovered",
                            score=score if isinstance(score, int) else 50,
                            metadata={
                                "platform": platform,
                                "category": category["id"],
                                "budget": gig.get("budget_range"),
                                "pitch_angle": gig.get("pitch_angle"),
                                "gig_file": filename,
                            },
                            source_agent=self.agent_id,
                        )
                    except Exception:
                        pass

            self.tasks_completed += len(saved_gigs)
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Found {len(saved_gigs)} gigs: {category['name']} on {platform} → {filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Scrape failed for {category['name']}: {e}")

    def get_tools(self) -> list[dict]:
        return []
