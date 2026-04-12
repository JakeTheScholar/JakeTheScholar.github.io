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


# Product types that need visuals
VISUAL_PRODUCTS = [
    {
        "id": "trading-journal-cover",
        "title": "Trading Journal Cover Art",
        "prompt_hint": "professional trading journal cover, financial charts, dark theme, gold accents",
        "style": "digital product mockup",
    },
    {
        "id": "budget-planner-cover",
        "title": "Budget Planner Cover",
        "prompt_hint": "elegant budget planner cover, minimalist, pastel colors, clean typography space",
        "style": "digital product mockup",
    },
    {
        "id": "wall-art-finance-motivation",
        "title": "Finance Motivation Wall Art",
        "prompt_hint": "motivational finance quote wall art, luxury aesthetic, marble and gold",
        "style": "printable wall art",
    },
    {
        "id": "wall-art-trading-desk",
        "title": "Trading Desk Setup Art",
        "prompt_hint": "multiple monitor trading desk setup, neon glow, cyberpunk aesthetic, dark room",
        "style": "printable wall art",
    },
    {
        "id": "wall-art-bull-market",
        "title": "Bull Market Abstract Art",
        "prompt_hint": "abstract bull silhouette, stock chart overlay, green and gold, modern art",
        "style": "printable wall art",
    },
    {
        "id": "wall-art-crypto-futuristic",
        "title": "Crypto Futuristic Art",
        "prompt_hint": "futuristic cryptocurrency visualization, blockchain nodes, holographic, dark bg",
        "style": "printable wall art",
    },
    {
        "id": "planner-monthly-spread",
        "title": "Monthly Spread Background",
        "prompt_hint": "clean watercolor wash background, subtle texture, light neutral tones",
        "style": "planner background",
    },
    {
        "id": "etsy-listing-mockup",
        "title": "Etsy Listing Product Mockup",
        "prompt_hint": "iPad on marble desk displaying digital planner, flatlay, aesthetic workspace",
        "style": "product mockup photo",
    },
    {
        "id": "social-media-banner",
        "title": "Shop Banner Graphic",
        "prompt_hint": "Etsy shop banner, finance templates, professional, dark blue and gold",
        "style": "banner graphic",
    },
    {
        "id": "portfolio-tracker-cover",
        "title": "Portfolio Tracker Cover",
        "prompt_hint": "investment portfolio tracker cover, stock ticker elements, green accents, sleek",
        "style": "digital product mockup",
    },
    # ─── Clothing / POD Designs (print-ready, isolated on solid backgrounds) ───
    {
        "id": "tshirt-finance-hustle",
        "title": "Finance Hustle T-Shirt",
        "prompt_hint": "bold graphic design for a t-shirt print: a golden bull charging through stock chart candlesticks, dramatic lighting, isolated on solid black background, print-ready artwork, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "tshirt-trader-lifestyle",
        "title": "Trader Lifestyle Tee",
        "prompt_hint": "t-shirt print design: an EKG heartbeat line that transforms into a stock chart going up, ending with a dollar sign, white line art on solid black background, minimal clean design, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "tshirt-crypto-art",
        "title": "Crypto Culture Tee",
        "prompt_hint": "t-shirt graphic: a bitcoin coin with an astronaut helmet reflection in it, floating in space with stars, retro vaporwave purple and cyan colors, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "hoodie-streetwear-finance",
        "title": "Streetwear Finance Hoodie",
        "prompt_hint": "large back-print hoodie design: a roaring bear and charging bull facing each other with a stock chart between them, japanese wave art style, gold and white ink on solid black background, no text",
        "style": "hoodie graphic design",
    },
    {
        "id": "tshirt-motivational",
        "title": "Motivational Grind Tee",
        "prompt_hint": "t-shirt design: a vintage distressed circular badge emblem with a lion wearing a crown, laurel wreath border, old money luxury aesthetic, gold on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "tote-bag-finance",
        "title": "Finance Aesthetic Tote",
        "prompt_hint": "tote bag print design: elegant single continuous line drawing of a money tree growing from an open book, minimalist black line art on solid white background, sophisticated and clean",
        "style": "tote bag design",
    },
    {
        "id": "mug-trader-morning",
        "title": "Trader Morning Mug",
        "prompt_hint": "coffee mug wrap-around design: a panoramic stock trading chart that looks like a city skyline at sunrise, green candlesticks as buildings, warm orange sky gradient, clean vector illustration style",
        "style": "mug design",
    },
    {
        "id": "tshirt-gym-finance",
        "title": "Gym x Finance Crossover Tee",
        "prompt_hint": "t-shirt graphic: a muscular arm flexing while gripping a handful of cash and gold coins, comic book pop art style with halftone dots, bold black outlines, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "mug-coffee-trading",
        "title": "Coffee & Trading Mug",
        "prompt_hint": "mug design: a steaming coffee cup where the steam forms the shape of rising stock chart candlesticks, cozy morning trading aesthetic, warm colors, clean illustration on solid white background",
        "style": "mug design",
    },
    {
        "id": "tshirt-diamond-hands",
        "title": "Diamond Hands Tee",
        "prompt_hint": "t-shirt print: a pair of crystal diamond hands holding a glowing stock chart arrow pointing up, sparkling gem facets, luxury purple and blue tones, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "tshirt-wolf-wallstreet",
        "title": "Wall Street Wolf Tee",
        "prompt_hint": "t-shirt design: a stylized wolf in a business suit with city skyline silhouette behind, geometric low-poly art style, gold and navy blue, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "hoodie-neon-bull",
        "title": "Neon Bull Hoodie",
        "prompt_hint": "hoodie print: a neon wireframe bull made of glowing cyan and magenta light trails, cyberpunk style, isolated on solid black background, futuristic trading aesthetic, no text",
        "style": "hoodie graphic design",
    },
    {
        "id": "mug-market-open",
        "title": "Market Open Mug",
        "prompt_hint": "mug design: the New York Stock Exchange building facade with a dramatic sunrise behind it, golden hour lighting, architectural illustration, clean design on solid navy background",
        "style": "mug design",
    },
    {
        "id": "tshirt-candlestick-art",
        "title": "Candlestick Art Tee",
        "prompt_hint": "t-shirt graphic: abstract art made entirely of green and red stock candlestick patterns forming the shape of a mountain range, minimal geometric design, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "tote-bag-hustle",
        "title": "Hustle Tote Bag",
        "prompt_hint": "tote bag design: a vintage woodcut style illustration of a beehive with bees and honey, representing hustle and productivity, detailed crosshatching, black ink on solid cream white background, no text",
        "style": "tote bag design",
    },
    {
        "id": "tshirt-money-tree",
        "title": "Money Tree Tee",
        "prompt_hint": "t-shirt design: a beautiful bonsai tree with dollar bills as leaves and gold coins scattered at its base, detailed botanical illustration style, rich greens and golds, isolated on solid black background, no text",
        "style": "t-shirt graphic design",
    },
    {
        "id": "hoodie-retro-trader",
        "title": "Retro Trader Hoodie",
        "prompt_hint": "hoodie back print: a retro 80s style trading floor scene with old CRT monitors and ticker tape, synthwave sunset colors pink purple and orange, pixel art meets vaporwave, isolated on solid black background, no text",
        "style": "hoodie graphic design",
    },
    {
        "id": "mug-portfolio-pie",
        "title": "Portfolio Pie Chart Mug",
        "prompt_hint": "mug design: a colorful pie chart made to look like a delicious actual pie with different flavor slices representing asset classes, playful foodie illustration style, clean on solid white background",
        "style": "mug design",
    },
]

SD_STYLES = {
    "photorealistic": "photorealistic, 8k, high detail, professional photography",
    "digital_art": "digital art, trending on artstation, vibrant, detailed illustration",
    "minimalist": "minimalist design, clean lines, flat design, vector style",
    "watercolor": "watercolor painting, soft edges, muted tones, artistic",
}

PROMPT_SYSTEM = """You are an expert AI image prompt engineer for Stable Diffusion XL.
Generate a detailed, high-quality image generation prompt.

Rules:
- Output ONLY a JSON object with these fields: "prompt", "negative_prompt", "width", "height", "steps", "cfg_scale"
- The prompt should be detailed and specific (50-100 words)
- Include style descriptors, lighting, composition, color palette
- negative_prompt should list things to avoid (low quality, blurry, text, watermark, etc.)
- width/height should be appropriate for the product type (1024x1024 for square, 1024x1536 for portrait, 1536x1024 for landscape)
- steps: 25-35, cfg_scale: 5-8
- NO explanation, ONLY the JSON object"""


class ImageGenAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="image-gen-001",
            name="Image Generator",
            description="Generates product images via Stable Diffusion prompts, DALL-E 3 & local ComfyUI",
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
            # Build prompt directly from product hints (skip flaky LLM JSON step)
            dalle_prompt = (
                f"A sleek {product['style']} of {product['prompt_hint']}, "
                f"rendered in {style_suffix}, suitable for an Etsy digital product listing. "
                f"High quality, professional, clean composition."
            )
            prompt_data = {
                "prompt": dalle_prompt,
                "negative_prompt": "low quality, blurry, text, watermark, amateur",
                "width": 1024,
                "height": 1024,
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
                    "size": "1024x1024",
                    "quality": "standard",
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
