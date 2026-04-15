"""Music Agent — generates audio branding specs and sellable audio product concepts."""

import sys
import asyncio
import random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output


# ─── Audio branding tasks (ties into content pipeline) ───
BRANDING_TASKS = [
    {"type": "jingle", "desc": "5-second brand jingle for TikTok/Reels intro"},
    {"type": "intro", "desc": "10-second podcast/YouTube intro music"},
    {"type": "background", "desc": "30-second lo-fi background loop for content videos"},
    {"type": "transition", "desc": "2-second transition sound effect for carousel posts"},
    {"type": "outro", "desc": "8-second outro music with CTA energy"},
    {"type": "notification", "desc": "Short notification/alert sound for app or brand"},
]

BRANDING_PROMPT = """Create a detailed audio production brief for: {desc}

Brand context: Personal finance / digital printables brand targeting Gen-Z and millennials.
Mood: Professional but approachable, modern, slightly techy.

Return a JSON object:
- "title": Descriptive title for this audio piece
- "type": "{audio_type}"
- "duration": Exact duration in seconds
- "bpm": Tempo in BPM
- "key": Musical key (e.g. "C major", "A minor")
- "mood": Array of 3-4 mood descriptors
- "instruments": Array of instruments/sounds to use
- "structure": Description of the arrangement (intro, build, drop, etc.)
- "reference_style": 1-2 well-known songs or artists this should sound like
- "suno_prompt": A ready-to-use prompt for Suno AI (under 200 chars, descriptive)
- "use_case": Where this audio will be used in the content pipeline

Return ONLY valid JSON."""

# ─── Sellable audio product tasks ───
PRODUCT_TYPES = [
    {"genre": "Lo-Fi Study Beats", "audience": "students, remote workers", "platform": "etsy"},
    {"genre": "Meditation & Ambient", "audience": "wellness enthusiasts", "platform": "etsy"},
    {"genre": "Podcast Intro Pack", "audience": "podcasters, YouTubers", "platform": "fiverr"},
    {"genre": "Corporate Background Music", "audience": "businesses, presentations", "platform": "etsy"},
    {"genre": "Royalty-Free Beat Pack", "audience": "content creators, streamers", "platform": "etsy"},
    {"genre": "Workout/Gym Mix", "audience": "fitness creators, gyms", "platform": "fiverr"},
    {"genre": "Chill Hip-Hop Instrumentals", "audience": "vloggers, lifestyle creators", "platform": "etsy"},
    {"genre": "Nature Soundscapes", "audience": "sleep, focus, relaxation", "platform": "etsy"},
]

PRODUCT_PROMPT = """Create a sellable audio product concept and listing for:
Genre: {genre}
Target audience: {audience}
Sell on: {platform}

Return a JSON object:
- "product_name": Catchy product name for the listing
- "genre": "{genre}"
- "track_count": Number of tracks in the pack (5-15)
- "total_duration": Total duration in minutes
- "tracks": Array of 5 track objects, each with:
  - "title": Track name
  - "duration": Duration string (e.g. "3:24")
  - "bpm": Tempo
  - "key": Musical key
  - "mood": Brief mood description
  - "suno_prompt": Ready-to-use Suno AI prompt for this track (under 200 chars)
- "listing_title": {platform} listing title (keyword-rich, under 140 chars)
- "listing_description": Full product description (300-500 words)
- "tags": Array of 13 search tags
- "price": Suggested price in USD
- "license_type": "royalty-free personal" or "royalty-free commercial"
- "preview_strategy": How to create preview clips to attract buyers

Return ONLY valid JSON."""


class MusicAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="music-001",
            name="Music Agent",
            description="Audio branding & sellable music",
            color="#fb923c",
        )
        self.tick_interval = 130
        self.pipeline_db = None
        self.branding_index = 0
        self.product_index = 0
        self.mode = "branding"  # alternates: branding, product

    async def tick(self) -> AgentEvent:
        if self.mode == "branding":
            result = await self._do_branding()
            self.mode = "product"
        else:
            result = await self._do_product()
            self.mode = "branding"
        return result

    async def _do_branding(self) -> AgentEvent:
        task = BRANDING_TASKS[self.branding_index % len(BRANDING_TASKS)]

        self.current_task = {
            "type": "audio-branding",
            "description": f"Creating {task['desc']}",
        }

        self.emit("generating", f"Designing {task['type']}: {task['desc']}")

        try:
            prompt = BRANDING_PROMPT.format(desc=task["desc"], audio_type=task["type"])
            system = (
                "You are a music producer and audio branding specialist. "
                "You create detailed production briefs that can be handed to a producer or AI tool. "
                "Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            save_result = save_output(result, "music", f"audio-brand-{task['type']}", fmt="json")

            # Track in content pipeline as audio branding
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "content", f"Audio: {task['desc'][:50]}",
                        subtitle=task["type"],
                        stage="created", score=55,
                        metadata={"audio_type": task["type"], "filename": save_result["filename"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.branding_index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Audio branding: {task['type']} → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Branding failed: {e}")

    async def _do_product(self) -> AgentEvent:
        product = PRODUCT_TYPES[self.product_index % len(PRODUCT_TYPES)]
        genre = product["genre"]

        self.current_task = {
            "type": "audio-product",
            "description": f"Creating {genre} product concept",
        }

        self.emit("generating", f"Building {genre} product pack")

        try:
            prompt = PRODUCT_PROMPT.format(
                genre=genre, audience=product["audience"], platform=product["platform"]
            )
            system = (
                "You are a music producer who sells audio packs on Etsy and Fiverr. "
                "You know what sells and how to write listings that convert. "
                "Output only valid JSON."
            )

            result = await self.llm.generate(prompt, system=system, complexity="low")

            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            slug = genre.lower().replace(" ", "-").replace("/", "-")[:30]
            save_result = save_output(result, "music", f"audio-product-{slug}", fmt="json")

            # Track in audio pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "audio", genre,
                        subtitle=product["platform"],
                        stage="concept", score=random.randint(50, 75),
                        metadata={
                            "genre": genre,
                            "audience": product["audience"],
                            "platform": product["platform"],
                            "filename": save_result["filename"],
                        },
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.product_index += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"{genre} product pack → {save_result['filename']}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Product failed: {e}")

    def get_tools(self) -> list[dict]:
        return []
