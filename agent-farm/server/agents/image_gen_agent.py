"""Image Gen Agent — generates SD/ComfyUI prompts and calls local image API."""

import sys
import os
import json
import asyncio
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir


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
            description="Generates product images via Stable Diffusion prompts & local ComfyUI",
            color="#e879f9",
        )
        self.tick_interval = 90
        self.pipeline_db = None
        self.index = 0
        self.comfyui_url = os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")

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
            prompt = (
                f"Create a Stable Diffusion XL prompt for: {product['prompt_hint']}\n"
                f"Style: {product['style']} — {style_suffix}\n"
                f"This is for an Etsy digital product listing."
            )

            result = await self.llm.generate(prompt, system=PROMPT_SYSTEM, complexity="low")

            # Parse the JSON
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()

            try:
                prompt_data = json.loads(result)
            except json.JSONDecodeError:
                self.current_task = None
                return self.emit("skipped", f"Invalid JSON from LLM for {product['title']}")

            # Save prompt file
            out_dir = ensure_output_dir("image-prompts")
            filename = f"{product['id']}-{style_key}-{self.tasks_completed:04d}.json"
            filepath = out_dir / filename
            prompt_data["product_id"] = product["id"]
            prompt_data["product_title"] = product["title"]
            prompt_data["style"] = style_key
            filepath.write_text(json.dumps(prompt_data, indent=2), encoding="utf-8")

            # Try to generate via local ComfyUI if available
            generated_image = False
            try:
                generated_image = await self._try_comfyui(prompt_data, product["id"], style_key)
            except Exception:
                pass  # ComfyUI not available, that's fine — prompt saved

            # Track in pipeline
            if self.pipeline_db:
                try:
                    stage = "designed" if generated_image else "drafted"
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "etsy", f"{product['title']} ({style_key})",
                        subtitle="image",
                        stage=stage, score=random.randint(60, 90),
                        metadata={"prompt_file": filename, "generated": generated_image,
                                  "style": style_key, "product_id": product["id"]},
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.index += 1
            self.current_task = None

            status = "image generated" if generated_image else "prompt saved (ComfyUI offline)"
            return self.emit(
                "completed",
                f"{product['title']} ({style_key}) — {status} → {filename}"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed: {product['title']}: {e}")

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
