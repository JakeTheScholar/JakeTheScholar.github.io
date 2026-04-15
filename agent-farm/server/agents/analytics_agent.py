"""Analytics Agent — generates sales projections, A/B test plans, and KPI dashboards."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output, list_outputs


ANALYTICS_TASKS = [
    {"type": "sales-projection", "desc": "Monthly sales projection model"},
    {"type": "pricing-analysis", "desc": "Price optimization analysis across products"},
    {"type": "ab-test-plan", "desc": "A/B test plan for listing titles and thumbnails"},
    {"type": "kpi-dashboard", "desc": "KPI tracking dashboard template"},
    {"type": "conversion-funnel", "desc": "Conversion funnel analysis (view → favorite → purchase)"},
    {"type": "product-performance", "desc": "Product performance ranking and recommendations"},
    {"type": "revenue-forecast", "desc": "30/60/90 day revenue forecast model"},
    {"type": "customer-segments", "desc": "Customer segmentation analysis"},
]

ANALYTICS_PROMPT = """Create a {type} for a digital printables e-commerce business selling financial templates on Etsy and Fiverr.

Task: {desc}

Return a JSON object:
- "report_type": "{type}"
- "title": Report title
- "summary": 2-3 sentence executive summary
- "methodology": Brief description of approach
- "data": Object containing the core analysis (tables as arrays of objects, metrics as key-value pairs)
- "visualizations": Array of chart descriptions (what to plot, axes, type)
- "insights": Array of 3-5 key insights from the analysis
- "action_items": Array of 3-4 specific next steps with priority (high/medium/low)
- "assumptions": Array of assumptions made in this analysis

Use realistic placeholder numbers for a new Etsy shop (1-3 months old, 10-20 products).
Return ONLY valid JSON."""


class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="analytics-001",
            name="Analytics Agent",
            description="Sales tracking & A/B testing",
            color="#fbbf24",
        )
        self.tick_interval = 150
        self.index = 0

    async def tick(self) -> AgentEvent:
        task = ANALYTICS_TASKS[self.index % len(ANALYTICS_TASKS)]

        self.current_task = {
            "type": task["type"],
            "description": task["desc"],
        }

        self.emit("analyzing", f"Running: {task['desc']}")

        try:
            prompt = ANALYTICS_PROMPT.format(type=task["type"], desc=task["desc"])
            system = (
                "You are a data analyst specializing in e-commerce analytics. "
                "You build models, forecasts, and actionable reports. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            save_result = save_output(result, "analytics-reports", f"analytics-{task['type']}", fmt="json")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"{task['desc']} → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
