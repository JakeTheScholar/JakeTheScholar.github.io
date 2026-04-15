"""Image Gen Agent — generates SD/ComfyUI prompts and calls local image API + DALL-E 3."""

import sys
import os
import json
import asyncio
import logging
import random
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir

log = logging.getLogger(__name__)


# ─── YouTube Thumbnails & Visual Content ───
VISUAL_PRODUCTS = [
    # ─── YouTube Thumbnails (16:9, high-impact, scroll-stopping) ───
    {
        "id": "yt-thumb-trading-profits",
        "title": "YT Thumb: Trading Profits Reveal",
        "prompt_hint": "YouTube thumbnail, bold green profit numbers overlaid on dark trading screen, shocked face silhouette, bright green glow effect, dramatic composition, 16:9 aspect ratio",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-market-crash",
        "title": "YT Thumb: Market Crash Alert",
        "prompt_hint": "YouTube thumbnail, red stock chart crashing downward, emergency warning aesthetic, dark background, red glow, bold dramatic layout, 16:9 aspect ratio",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-side-hustle",
        "title": "YT Thumb: Side Hustle Money",
        "prompt_hint": "YouTube thumbnail, cash fanning out from laptop screen, neon green money glow, dark room with monitor light, hustle aesthetic, clean composition, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-crypto-analysis",
        "title": "YT Thumb: Crypto Deep Dive",
        "prompt_hint": "YouTube thumbnail, bitcoin and ethereum coins floating over futuristic chart, holographic blue-purple glow, dark tech aesthetic, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-passive-income",
        "title": "YT Thumb: Passive Income Secrets",
        "prompt_hint": "YouTube thumbnail, money tree growing from a laptop with golden coins raining, warm sunset glow, clean dark background, aspirational wealth aesthetic, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-day-trading-setup",
        "title": "YT Thumb: Day Trading Setup",
        "prompt_hint": "YouTube thumbnail, multi-monitor trading desk setup with green candlestick charts, moody dark room, blue and green ambient lighting, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-budget-hack",
        "title": "YT Thumb: Budget Hack That Works",
        "prompt_hint": "YouTube thumbnail, calculator and stacked coins with upward arrow, clean minimal background with pop of green, financial planning aesthetic, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-investing-beginner",
        "title": "YT Thumb: Investing for Beginners",
        "prompt_hint": "YouTube thumbnail, stock market chart going up with step-by-step staircase visual, welcoming blue and green tones, clean and approachable, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-etsy-income",
        "title": "YT Thumb: Etsy Income Report",
        "prompt_hint": "YouTube thumbnail, Etsy-style shop aesthetic with revenue dashboard overlay, orange and white brand colors, product mockups floating, clean, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-ai-money",
        "title": "YT Thumb: Making Money with AI",
        "prompt_hint": "YouTube thumbnail, robotic hand holding cash, futuristic AI brain visualization in background, electric blue and gold, dark tech aesthetic, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-forex-strategy",
        "title": "YT Thumb: Forex Strategy Breakdown",
        "prompt_hint": "YouTube thumbnail, forex currency pairs chart with drawn-on strategy arrows, trading annotation aesthetic, dark background with cyan accents, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-financial-freedom",
        "title": "YT Thumb: Road to Financial Freedom",
        "prompt_hint": "YouTube thumbnail, road leading to sunrise horizon with dollar signs as mile markers, aspirational journey visual, warm golden tones on dark, 16:9",
        "style": "youtube thumbnail",
    },
    # ─── Social Media & Content Thumbnails ───
    {
        "id": "ig-reel-cover-finance",
        "title": "IG Reel Cover: Finance Tip",
        "prompt_hint": "Instagram reel cover, bold typography space on dark gradient background, money and chart iconography, vertical 9:16, clean minimal design",
        "style": "social media cover",
    },
    {
        "id": "tiktok-cover-trading",
        "title": "TikTok Cover: Trading Content",
        "prompt_hint": "TikTok video cover, trading chart aesthetic, green candlesticks, dark moody background, bold space for overlay text, vertical 9:16",
        "style": "social media cover",
    },
    {
        "id": "podcast-cover-finance",
        "title": "Podcast Cover: Finance Talk",
        "prompt_hint": "podcast cover art, professional microphone with financial chart waveform, dark background, gold and blue accents, square 1:1, clean design",
        "style": "podcast cover",
    },
    {
        "id": "blog-header-investing",
        "title": "Blog Header: Investing Guide",
        "prompt_hint": "blog header image, clean financial planning workspace flatlay, notebook with charts, coffee cup, minimal aesthetic, natural lighting, 16:9",
        "style": "blog header",
    },
    {
        "id": "yt-thumb-stock-picks",
        "title": "YT Thumb: Top Stock Picks",
        "prompt_hint": "YouTube thumbnail, stock ticker symbols floating in 3D space, green arrows pointing up, dark background with spotlight effect, bold and clean, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-options-trading",
        "title": "YT Thumb: Options Trading 101",
        "prompt_hint": "YouTube thumbnail, options chain visualization with call/put arrows, educational vibe, dark background with green and red accents, clean typography space, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-real-estate",
        "title": "YT Thumb: Real Estate Investing",
        "prompt_hint": "YouTube thumbnail, luxury house with golden key and rising property value chart, warm golden hour lighting, aspirational wealth aesthetic, 16:9",
        "style": "youtube thumbnail",
    },
    {
        "id": "yt-thumb-debt-free",
        "title": "YT Thumb: Debt Free Journey",
        "prompt_hint": "YouTube thumbnail, broken chain links with money flying free, transformation before-after aesthetic, dark to bright gradient, powerful visual, 16:9",
        "style": "youtube thumbnail",
    },
]

SD_STYLES = {
    "flat_vector": "flat 2d vector artwork, clean lines, simple shapes, solid colors, professional graphic design",
    "retro_vintage": "retro vintage screen print style, distressed texture, muted color palette, 1970s aesthetic",
    "minimalist": "minimalist design, clean lines, flat design, vector style, Scandinavian aesthetic",
    "hand_drawn": "hand-drawn illustration style, organic imperfect lines, sketch quality, ink on paper feel",
}

PROMPT_SYSTEM = """You are an expert thumbnail and visual content prompt engineer. Your goal is
to create prompts that produce SCROLL-STOPPING thumbnails and covers — bold, high contrast,
clean composition. These are for YouTube, social media, and content platforms.

Rules:
- Output ONLY a JSON object with these fields: "prompt", "negative_prompt", "width", "height", "steps", "cfg_scale"
- The prompt should be 50-100 words, focused on bold, eye-catching composition
- Thumbnails need HIGH CONTRAST — bright subjects on dark backgrounds, or vice versa
- Leave CLEAR SPACE for text overlay (titles, numbers, etc.)
- Use dramatic but intentional lighting — spotlights, glows, rim lighting
- NEVER use these AI-slop terms: "trending on artstation", "8k", "hyper realistic", "octane render", "masterpiece", "best quality", "highly detailed", "ray tracing", "volumetric lighting"
- negative_prompt MUST include: "glossy, plastic look, oversaturated, cluttered, text, words, letters, watermark, low quality, blurry"
- width/height: 1536x1024 for YouTube thumbnails (16:9), 1024x1536 for vertical (9:16), 1024x1024 for square
- steps: 25-35, cfg_scale: 5-7
- NO explanation, ONLY the JSON object"""


class ImageGenAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="image-gen-001",
            name="Image Generator",
            description="Generates YouTube thumbnails & visual content via DALL-E 3 & local ComfyUI",
            color="#e879f9",
        )
        self.tick_interval = 90
        self.pipeline_db = None
        self.index = 0
        self.comfyui_url = os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")
        self._openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self._dalle_enabled = os.getenv("DALLE_ENABLED", "true").lower() in ("true", "1", "yes")

    async def tick(self) -> AgentEvent:
        product = VISUAL_PRODUCTS[self.index % len(VISUAL_PRODUCTS)]
        style_key = list(SD_STYLES.keys())[self.index % len(SD_STYLES)]
        style_suffix = SD_STYLES[style_key]

        self.current_task = {
            "type": "image-gen",
            "description": f"Generating prompt for {product['title']} ({style_key})",
        }

        self.emit("generating", f"Creating image prompt: {product['title']} ({style_key})")

        try:
            # Build prompt with anti-AI-slop directives
            dalle_prompt = (
                f"{product['prompt_hint']}, "
                f"{style_suffix}, "
                f"commercial product design, clean edges, intentional color palette. "
                f"This should look like a professional human graphic designer made it, "
                f"not AI-generated. Avoid glossy or plastic look. Muted, natural colors."
            )
            # Pick dimensions based on style
            is_vertical = "9:16" in product.get("prompt_hint", "")
            is_square = "1:1" in product.get("prompt_hint", "")
            if is_vertical:
                w, h = 1024, 1536
            elif is_square:
                w, h = 1024, 1024
            else:
                w, h = 1536, 1024  # 16:9 default for thumbnails

            prompt_data = {
                "prompt": dalle_prompt,
                "negative_prompt": "glossy, plastic look, oversaturated, cluttered, text, words, letters, watermark, low quality, blurry",
                "width": w,
                "height": h,
                "steps": 30,
                "cfg_scale": 7,
                "product_id": product["id"],
                "product_title": product["title"],
                "style": style_key,
            }

            # Save prompt file
            out_dir = ensure_output_dir("image-prompts")
            filename = f"{product['id']}-{style_key}-{self.tasks_completed:04d}.json"
            filepath = out_dir / filename
            filepath.write_text(json.dumps(prompt_data, indent=2), encoding="utf-8")

            # Try DALL-E 3 generation (1 image per tick for rate limiting)
            dalle_image_path = None
            generated_image = False
            generation_method = None
            try:
                dalle_image_path = await self._try_dalle(
                    prompt_data, product["id"], style_key,
                )
                if dalle_image_path:
                    generated_image = True
                    generation_method = "dalle-3"
            except Exception as exc:
                log.warning("DALL-E 3 generation failed for %s: %s", product["id"], exc)

            # Try to generate via local ComfyUI if DALL-E didn't produce an image
            if not generated_image:
                try:
                    comfy_ok = await self._try_comfyui(prompt_data, product["id"], style_key)
                    if comfy_ok:
                        generated_image = True
                        generation_method = "comfyui"
                except Exception:
                    pass  # ComfyUI not available, that's fine — prompt saved

            # Track in pipeline
            if self.pipeline_db:
                try:
                    stage = "designed" if generated_image else "drafted"
                    meta = {
                        "prompt_file": filename,
                        "generated": generated_image,
                        "generation_method": generation_method,
                        "style": style_key,
                        "product_id": product["id"],
                    }
                    if dalle_image_path:
                        meta["dalle_image"] = str(dalle_image_path)
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "etsy", f"{product['title']} ({style_key})",
                        subtitle="image",
                        stage=stage, score=random.randint(60, 90),
                        metadata=meta,
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            if generated_image:
                status = f"image generated via {generation_method}"
            else:
                status = "prompt saved (no image backend available)"
            return self.emit(
                "completed",
                f"{product['title']} ({style_key}) — {status} → {filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {product['title']}: {e}")

    async def _try_dalle(
        self,
        prompt_data: dict,
        product_id: str,
        style: str,
    ) -> Path | None:
        """Generate an image via OpenAI DALL-E 3 API and save it as PNG.

        Returns the saved file path on success, or None if skipped / failed.
        """
        if not self._dalle_enabled:
            return None
        if not self._openai_api_key:
            log.info("DALL-E skipped: OPENAI_API_KEY not set")
            return None

        dalle_prompt = prompt_data.get("prompt", "")
        if not dalle_prompt:
            return None

        self.emit("generating", f"Calling DALL-E 3 for {product_id} ({style})...")

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {self._openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": dalle_prompt,
                    "n": 1,
                    "size": "1792x1024" if prompt_data.get("width", 1024) > prompt_data.get("height", 1024) else ("1024x1792" if prompt_data.get("height", 1024) > prompt_data.get("width", 1024) else "1024x1024"),
                    "quality": "standard",
                    "style": "vivid",  # Vivid works better for bold thumbnails
                },
            )
            resp.raise_for_status()
            data = resp.json()

        image_url = data["data"][0]["url"]

        # Download the generated image
        async with httpx.AsyncClient(timeout=60) as client:
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()
            image_bytes = img_resp.content

        # Save to output/images/
        img_dir = ensure_output_dir("images")
        img_filename = f"{product_id}-{style}-{self.tasks_completed:04d}.png"
        img_path = img_dir / img_filename
        img_path.write_bytes(image_bytes)

        log.info("DALL-E 3 image saved: %s (%d bytes)", img_path, len(image_bytes))
        return img_path

    async def _try_comfyui(self, prompt_data: dict, product_id: str, style: str) -> bool:
        """Attempt to generate an image via local ComfyUI API."""
        try:
            import aiohttp
        except ImportError:
            return False

        # Simple txt2img workflow for ComfyUI API
        payload = {
            "prompt": {
                "3": {
                    "class_type": "KSampler",
                    "inputs": {
                        "seed": random.randint(0, 2**32),
                        "steps": prompt_data.get("steps", 30),
                        "cfg": prompt_data.get("cfg_scale", 7),
                        "sampler_name": "euler",
                        "scheduler": "normal",
                        "denoise": 1.0,
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["5", 0],
                    },
                },
                "4": {"class_type": "CheckpointLoaderSimple",
                      "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
                "5": {"class_type": "EmptyLatentImage",
                      "inputs": {"width": prompt_data.get("width", 1024),
                                 "height": prompt_data.get("height", 1024),
                                 "batch_size": 1}},
                "6": {"class_type": "CLIPTextEncode",
                      "inputs": {"text": prompt_data.get("prompt", ""),
                                 "clip": ["4", 1]}},
                "7": {"class_type": "CLIPTextEncode",
                      "inputs": {"text": prompt_data.get("negative_prompt", ""),
                                 "clip": ["4", 1]}},
                "8": {"class_type": "VAEDecode",
                      "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
                "9": {"class_type": "SaveImage",
                      "inputs": {"filename_prefix": f"agentfarm/{product_id}-{style}",
                                 "images": ["8", 0]}},
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.comfyui_url}/prompt",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120),
            ) as resp:
                if resp.status == 200:
                    return True
        return False

    def get_tools(self) -> list[dict]:
        return []
