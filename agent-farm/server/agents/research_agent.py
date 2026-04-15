"""Research Agent — analyzes market trends and competitor products."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


RESEARCH_TOPICS = [
    # Finance printables
    {"topic": "Etsy printable trends Q2 2026", "focus": "trending categories, price points, top sellers"},
    {"topic": "Budget planner market analysis", "focus": "competitors, pricing strategy, unique selling points"},
    {"topic": "Trading journal demand analysis", "focus": "target audience, search volume indicators, gaps in market"},
    {"topic": "Digital download pricing strategy", "focus": "price elasticity, bundle vs single, seasonal trends"},
    {"topic": "Personal finance content trends", "focus": "trending topics on social media, viral formats, audience demographics"},
    {"topic": "Fiverr financial template competition", "focus": "top sellers, pricing tiers, service differentiation"},
    {"topic": "Print-on-demand vs digital download", "focus": "margin comparison, fulfillment overhead, scalability"},
    {"topic": "SEO keywords for financial printables", "focus": "long-tail keywords, search intent, competition level"},
    # Clothing / POD
    {"topic": "Finance bro streetwear Etsy market", "focus": "top sellers, price points, design styles, audience demographics"},
    {"topic": "Print-on-demand t-shirt profitability 2026", "focus": "Printful vs Printify margins, best-selling niches, pricing sweet spots"},
    {"topic": "Crypto and trading apparel trends", "focus": "viral designs, meme culture crossover, seasonal demand spikes"},
    {"topic": "Hustle culture merchandise demand", "focus": "motivational quote tees, entrepreneur lifestyle branding, target demographics"},
    {"topic": "POD fulfillment provider comparison", "focus": "Printful, Printify, Gooten — quality, shipping speed, Etsy integration, margins"},
]

RESEARCH_PROMPT = """Conduct a market research analysis on: "{topic}"

Focus areas: {focus}

Produce a detailed research report as JSON:
- "topic": The research topic
- "executive_summary": 2-3 sentence overview of findings
- "key_findings": Array of 5-7 bullet-point findings
- "opportunities": Array of 3-4 market opportunities identified
- "threats": Array of 2-3 risks or threats
- "recommendations": Array of 3-5 actionable recommendations
- "data_points": Object with relevant metrics/numbers (estimated where needed)
- "sources_to_check": Array of 3-5 places to manually verify these findings

Be specific and actionable. Base analysis on general market knowledge.
Return ONLY valid JSON."""


class ResearchAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="research-001",
            name="Research Agent",
            description="Market & trend research",
            color="#fb923c",
        )
        self.tick_interval = 180
        self.index = 0

    async def tick(self) -> AgentEvent:
        research = RESEARCH_TOPICS[self.index % len(RESEARCH_TOPICS)]
        topic = research["topic"]

        self.current_task = {
            "type": "research",
            "description": f"Researching: {topic}",
        }

        self.emit("researching", f"Analyzing: {topic}")

        try:
            prompt = RESEARCH_PROMPT.format(topic=topic, focus=research["focus"])
            system = (
                "You are a market research analyst specializing in e-commerce and digital products. "
                "You provide data-driven insights and actionable recommendations. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = topic.lower().replace(" ", "-")[:40]
            save_result = save_output(result, "research-reports", f"research-{slug}", fmt="json")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Research report: {topic} → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
