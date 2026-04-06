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

        complexity="low"  -> always Ollama
        complexity="high" -> try Ollama, fallback to Claude
        """
        # Try Ollama first
        try:
            result = await self.ollama.generate(self.model, prompt, system)
            if result and len(result.strip()) > 10:
                return result.strip()
        except Exception as e:
            log.error(f"Ollama generate failed: {e}")
            if complexity == "low":
                return "[LLM Error] Ollama unavailable"

        # Claude fallback for high-complexity tasks
        if complexity == "high" and self.anthropic_client:
            return await self._claude_generate(prompt, system)

        return "[LLM Error] No model available"

    async def _claude_generate(self, prompt: str, system: str = None) -> str:
        try:
            kwargs = {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 4096,
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
