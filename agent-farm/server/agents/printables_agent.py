"""Printables Designer Agent — generates financial templates for Etsy."""

import sys
import os
import random
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.template_tools import (
    TEMPLATE_TYPES, get_template_prompt, get_variation_prompt, GENERATE_TEMPLATE_SCHEMA
)
from tools.file_tools import save_template, list_outputs, SAVE_TEMPLATE_SCHEMA, LIST_OUTPUTS_SCHEMA


STYLES = ["modern", "classic", "bold", "pastel"]


class PrintablesAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="printables-001",
            name="Printables Designer",
            description="Generates financial templates, trading journals, and planners for Etsy",
            color="#00d4ff",
        )
        self.tick_interval = 60
        self.pipeline_db = None
        self.template_queue = list(TEMPLATE_TYPES.keys())
        self.style_index = 0
        self.queue_index = 0

    async def tick(self) -> AgentEvent:
        # Pick next template type (rotate through all types and styles)
        template_type = self.template_queue[self.queue_index % len(self.template_queue)]
        style = STYLES[self.style_index % len(STYLES)]
        tmpl_info = TEMPLATE_TYPES[template_type]

        # Emit "working" event
        self.current_task = {
            "type": template_type,
            "style": style,
            "description": f"Generating {tmpl_info['title']} ({style} style)",
        }

        working_event = self.emit(
            "generating",
            f"Creating {tmpl_info['title']} — {style} style"
        )

        # Generate the template via LLM
        prompt = get_variation_prompt(template_type, style)
        system = (
            "You are a professional printable template designer. "
            "You create beautiful, print-ready HTML templates for financial planning. "
            "Output only valid HTML. No explanations."
        )

        try:
            html_content = await self.llm.generate(prompt, system=system, complexity="low")

            # Clean up — extract just the HTML if wrapped in markdown
            if "```html" in html_content:
                html_content = html_content.split("```html")[1].split("```")[0].strip()
            elif "```" in html_content:
                html_content = html_content.split("```")[1].split("```")[0].strip()

            # Validate we got something useful
            if "<html" not in html_content.lower() and "<table" not in html_content.lower():
                self.current_task = None
                return self.emit("skipped", f"LLM output didn't contain valid HTML, skipping")

            # Save the template
            result = save_template(html_content, f"{template_type}-{style}", fmt="html")

            # Track in Etsy pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "etsy", f"{tmpl_info['title']} ({style})",
                        subtitle=template_type,
                        stage="drafted", score=random.randint(50, 80),
                        metadata={"style": style, "filename": result["filename"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.current_task = None

            # Advance rotation
            self.style_index += 1
            if self.style_index % len(STYLES) == 0:
                self.queue_index += 1

            return self.emit(
                "completed",
                f"Saved {tmpl_info['title']} ({style}) → {result['filename']} ({result['size_bytes']} bytes)"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed to generate {tmpl_info['title']}: {e}")

    def get_tools(self) -> list[dict]:
        return [GENERATE_TEMPLATE_SCHEMA, SAVE_TEMPLATE_SCHEMA, LIST_OUTPUTS_SCHEMA]
