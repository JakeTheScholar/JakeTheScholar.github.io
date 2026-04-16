"""Routes LLM requests to Ollama (default) or Claude API (fallback)."""

import os
import logging
from ollama_client import OllamaClient

log = logging.getLogger("llm-router")

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class LLMRouter:
    def __init__(self, ollama: OllamaClient, model: str = "llama3.2"):
        self.ollama = ollama
        self.model = model
        self.anthropic_client = None
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key and HAS_ANTHROPIC:
            self.anthropic_client = anthropic.Anthropic(api_key=api_key)

    async def generate(self, prompt: str, system: str = None, complexity: str = "low") -> str:
        """
        Generate text using Ollama (default) or Claude API (fallback).

        complexity="low"  -> always Ollama (default ctx)
        complexity="high" -> try Ollama with expanded context/output budget,
                             fallback to Claude if output is truncated or fails.
        """
        # Give high-complexity tasks (mockups, long emails) a bigger context +
        # unbounded num_predict so Ollama doesn't clip at 2048 tokens.
        options = None
        if complexity == "high":
            options = {"num_ctx": 8192, "num_predict": 8192}

        ollama_result: str | None = None
        try:
            ollama_result = await self.ollama.generate(self.model, prompt, system, options=options)
        except Exception as e:
            log.error(f"Ollama generate failed: {e}")
            if complexity == "low":
                return "[LLM Error] Ollama unavailable"

        # For low-complexity, return whatever Ollama produced.
        if complexity == "low":
            if ollama_result and len(ollama_result.strip()) > 10:
                return ollama_result.strip()
            return "[LLM Error] No model available"

        # For high-complexity (e.g. mockup HTML), detect truncated output and
        # fall back to Claude. A complete HTML response ends with </html>;
        # if Ollama clipped, we'd rather pay for a Claude call than save a
        # broken file that the manager has to auto-fix later.
        def looks_truncated(text: str) -> bool:
            if not text or len(text.strip()) < 100:
                return True
            lowered = text.lower()
            # If the prompt is asking for HTML, demand a closing </html>
            if "<html" in lowered or "<!doctype html" in lowered:
                return "</html>" not in lowered
            return False

        if ollama_result and not looks_truncated(ollama_result):
            return ollama_result.strip()

        if self.anthropic_client:
            log.info("High-complexity: Ollama output looked truncated, falling back to Claude")
            return await self._claude_generate(prompt, system)

        # No Claude available — return whatever Ollama gave us (better than nothing)
        if ollama_result and len(ollama_result.strip()) > 10:
            return ollama_result.strip()

        return "[LLM Error] No model available"

    async def _claude_generate(self, prompt: str, system: str = None) -> str:
        try:
            kwargs = {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 8192,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                kwargs["system"] = system
            response = self.anthropic_client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as e:
            log.error(f"Claude API failed: {e}")
            return "[LLM Error] Claude API unavailable"

    async def get_status(self) -> dict:
        ollama_ok = await self.ollama.health()
        models = await self.ollama.list_models() if ollama_ok else []
        return {
            "ollama_connected": ollama_ok,
            "ollama_models": models,
            "active_model": self.model,
            "claude_available": self.anthropic_client is not None,
        }
