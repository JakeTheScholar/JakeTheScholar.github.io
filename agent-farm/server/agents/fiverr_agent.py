"""Fiverr Gig Agent — generates Fiverr gig descriptions and packages,
and processes incoming Fiverr orders by dispatching to the right agent."""

import sys
import json
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


GIG_TYPES = [
    {"service": "Custom Budget Spreadsheet", "category": "Financial Consulting"},
    {"service": "Trading Journal Template", "category": "Data Entry & Spreadsheets"},
    {"service": "Business Financial Dashboard", "category": "Financial Consulting"},
    {"service": "Debt Payoff Planner", "category": "Financial Consulting"},
    {"service": "Investment Portfolio Tracker", "category": "Data Entry & Spreadsheets"},
    {"service": "Monthly Budget Planner", "category": "Financial Consulting"},
    {"service": "Expense Report Template", "category": "Data Entry & Spreadsheets"},
    {"service": "Revenue Forecasting Model", "category": "Financial Consulting"},
    {"service": "YouTube Thumbnail Design", "category": "Graphics & Design"},
    {"service": "Social Media Content Pack", "category": "Digital Marketing"},
    {"service": "Ad Copy & Campaign Strategy", "category": "Digital Marketing"},
    {"service": "SEO Keyword Research Report", "category": "Digital Marketing"},
]

GIG_PROMPT = """Create a Fiverr gig listing for: "{service}"
Category: {category}
Seller: JakeTheScholar — Economics major, data & finance nerd, builds custom spreadsheets and digital tools. Brand voice: sharp, friendly, no fluff.

Return a JSON object:
- "title": Fiverr gig title (start with "I will", max 80 chars)
- "description": Full gig description (300-500 words). Write as JakeTheScholar — confident, analytical, approachable. Reference real expertise in finance, data, and digital marketing. Highlight deliverables and turnaround.
- "search_tags": Array of 5 Fiverr search tags
- "packages": Object with "basic", "standard", "premium" keys, each having:
  - "name": Package name
  - "description": What's included (1-2 sentences)
  - "price": Price in USD
  - "delivery_days": Delivery time
  - "revisions": Number of revisions
- "faq": Array of 3 FAQ objects with "question" and "answer"
- "requirements": Array of 3 things to ask the buyer before starting
- "seller_name": "JakeTheScholar"

Return ONLY valid JSON."""

ORDER_FULFILLMENT_PROMPT = """You are fulfilling a Fiverr order. Create the deliverable based on the client's brief.

Order type: {order_type}
Client brief: {client_brief}
Package: {package}
{notes_section}

Generate a professional, high-quality deliverable that matches the client's requirements.
Structure your output as a JSON object with:
- "deliverable_type": Type of output (e.g. "document", "copy", "report")
- "title": Title of the deliverable
- "content": The actual deliverable content (detailed and complete)
- "notes_to_client": Brief message to include with delivery
- "revision_notes": What can be adjusted if the client wants changes

Return ONLY valid JSON."""


class FiverrAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="fiverr-001",
            name="Fiverr Gigs",
            description="Gig management, order intake & delivery",
            color="#8b5cf6",
        )
        self.tick_interval = 120
        self.pipeline_db = None
        self.index = 0

    async def tick(self) -> AgentEvent:
        # Priority: process pending orders first
        if self.pipeline_db:
            order = await asyncio.to_thread(
                self.pipeline_db.get_next_pending_order, "fiverr_gig"
            )
            if not order:
                # Also check for any assigned orders
                orders = await asyncio.to_thread(
                    self.pipeline_db.get_orders, "assigned", 5
                )
                order = next(
                    (o for o in orders if o.get("assigned_agent") == self.agent_id),
                    None,
                )
            if order:
                return await self._fulfill_order(order)

        # Default: generate new gig listings
        return await self._generate_gig()

    async def _fulfill_order(self, order: dict) -> AgentEvent:
        order_id = order["id"]
        client_brief = order.get("client_brief", "")
        order_type = order.get("order_type", "fiverr_gig")
        package = order.get("package", "basic")
        notes = order.get("notes", "")

        self.current_task = {
            "type": "order-fulfillment",
            "description": f"Fulfilling order {order_id}: {client_brief[:50]}",
        }

        # Mark as in progress
        await asyncio.to_thread(
            self.pipeline_db.update_order, order_id, status="in_progress"
        )

        self.emit("working", f"Processing order {order_id}")

        try:
            notes_section = f"Additional notes: {notes}" if notes else ""
            prompt = ORDER_FULFILLMENT_PROMPT.format(
                order_type=order_type,
                client_brief=client_brief,
                package=package,
                notes_section=notes_section,
            )
            system = (
                "You are JakeTheScholar, a top-rated Fiverr seller. Deliver professional, "
                "complete work that exceeds client expectations. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            # Save deliverable
            save_result = save_output(
                result, "fiverr-deliveries",
                f"order-{order_id}-{order_type}", fmt="json"
            )

            # Update order with output file
            await asyncio.to_thread(
                self.pipeline_db.update_order, order_id,
                status="review",
                output_files=[save_result["filename"]],
            )

            self.tasks_completed += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Order {order_id} fulfilled → {save_result['filename']} (ready for review)"
            )

        except Exception as e:
            self.current_task = None
            await asyncio.to_thread(
                self.pipeline_db.update_order, order_id, status="pending",
                notes=f"Failed: {e}",
            )
            return self.emit("error", f"Order {order_id} failed: {e}")

    async def _generate_gig(self) -> AgentEvent:
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
                "You are JakeTheScholar, a top-rated Fiverr seller specializing in financial templates, "
                "digital marketing, and design services. You're an Economics major who builds custom "
                "spreadsheets, dashboards, and digital tools. Write compelling gig descriptions "
                "that convert. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = service.lower().replace(" ", "-")
            save_result = save_output(result, "fiverr-gigs", f"gig-{slug}", fmt="json")

            # Track in Fiverr pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "fiverr", service,
                        subtitle=gig["category"],
                        stage="drafted", score=60,
                        metadata={"filename": save_result["filename"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

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
