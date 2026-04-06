"""Social Content Agent — generates social media posts to drive traffic."""

import sys
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template


PLATFORMS = ["instagram", "twitter", "tiktok", "pinterest"]

TOPICS = [
    "budgeting tips", "trading journal benefits", "debt payoff motivation",
    "net worth tracking", "financial goal setting", "expense tracking hacks",
    "passive income ideas", "investing for beginners", "money habits",
    "side hustle finance", "printable planner tips", "portfolio review",
]

SOCIAL_PROMPT = """Create a {platform} post about "{topic}" that promotes a digital printable template.

Return a JSON object:
- "platform": "{platform}"
- "caption": The full post caption (platform-appropriate length and tone)
- "hashtags": Array of 10-15 relevant hashtags
- "hook": The first line / hook that stops the scroll
- "cta": Call-to-action driving to Etsy shop
- "content_type": "carousel" | "single" | "reel_script" | "pin"
- "visual_description": Brief description of what the accompanying image/graphic should show

Tone: relatable, actionable, Gen-Z/millennial finance audience.
Return ONLY valid JSON."""


class SocialAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="social-001",
            name="Social Content",
            description="Social media posts & captions",
            color="#c9a96e",
        )
        self.tick_interval = 75
        self.index = 0

    async def tick(self) -> AgentEvent:
        platform = PLATFORMS[self.index % len(PLATFORMS)]
        topic = TOPICS[self.index % len(TOPICS)]

        self.current_task = {
            "type": "social-post",
            "description": f"Creating {platform} post about {topic}",
        }

        self.emit("generating", f"Writing {platform} post: {topic}")

        try:
            prompt = SOCIAL_PROMPT.format(platform=platform, topic=topic)
            system = (
                "You are a social media content creator for a personal finance brand. "
                "You create engaging, scroll-stopping content. Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            save_result = save_template(result, f"social-{platform}-{topic.replace(' ','-')}", fmt="json")
            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"{platform} post on '{topic}' → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
