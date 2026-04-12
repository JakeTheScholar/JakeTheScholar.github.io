"""Video Producer Agent — assembles Faceless Content scripts into Remotion TSX projects.

Closes the loop: Faceless Content writes scripts, Image Gen makes stills,
Music writes audio specs, and this agent stitches them into a renderable
Remotion composition. Follows the MaverickGPT TikTok recipe: Claude generates
the Remotion TypeScript that can be rendered via `npx remotion render`.
"""

import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import ensure_output_dir, OUTPUT_DIR


COMPOSITION_PROMPT = """Generate a complete Remotion TypeScript composition file for a short-form vertical video (9:16, 1080x1920, {fps} fps).

Script data (JSON):
{script_json}

Requirements:
- Export a single React functional component named `MyVideo`
- Use `AbsoluteFill`, `Sequence`, `interpolate`, `spring`, `useCurrentFrame`, `useVideoConfig` from 'remotion'
- Hook section (frames 0 to {hook_end}): big bold text overlay animating in, dark gradient background
- Body section: each text overlay appears as a separate `<Sequence>` with fade-in + slide-up spring animation
- CTA section (last ~{cta_frames} frames): larger text, pulsing scale animation
- Use `@remotion/google-fonts/Inter` for typography (import `loadFont`)
- Color palette: background #0a0a0f, accent #06b6d4, text #ffffff
- Text alignment centered, max-width 80%
- Add subtle `interpolate`-based opacity fade-in on all text
- TOTAL duration in frames: {total_frames}
- Include a top comment block with the video metadata (topic, platform, duration)

Output ONLY the complete TSX file. No markdown fences, no explanation."""


PACKAGE_JSON = """{
  "name": "agent-farm-video",
  "version": "1.0.0",
  "scripts": {
    "start": "remotion studio src/index.ts",
    "render": "remotion render src/index.ts MyVideo out/video.mp4",
    "upgrade": "remotion upgrade"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "remotion": "^4.0.0"
  }
}
"""

INDEX_TS = """import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';
registerRoot(RemotionRoot);
"""

ROOT_TS = """import { Composition } from 'remotion';
import { MyVideo } from './MyVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={{DURATION_FRAMES}}
      fps={{FPS}}
      width={1080}
      height={1920}
    />
  );
};
"""


class VideoProducerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="video-producer-001",
            name="Video Producer",
            description="Stitches scripts + stills + audio into renderable Remotion TSX projects",
            color="#a855f7",
        )
        self.tick_interval = 120
        self.pipeline_db = None
        self.produced_scripts: set[str] = set()  # filenames already processed
        self.fps = 30

    async def tick(self) -> AgentEvent:
        # Pull latest faceless content scripts
        scripts_dir = OUTPUT_DIR / "content-scripts"
        if not scripts_dir.exists():
            self.current_task = None
            return self.emit("waiting", "No content-scripts directory yet")

        script_files = sorted(
            [f for f in scripts_dir.iterdir() if f.is_file() and f.suffix == ".json"],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

        if not script_files:
            self.current_task = None
            return self.emit("waiting", "No scripts available to produce")

        target = None
        for f in script_files:
            if f.name not in self.produced_scripts:
                target = f
                break

        if not target:
            self.current_task = None
            return self.emit("waiting", "All available scripts already produced")

        self.current_task = {
            "type": "video-produce",
            "description": f"Building Remotion project from {target.name}",
        }
        self.emit("producing", f"Assembling video project from {target.name}")

        try:
            script_data = json.loads(target.read_text(encoding="utf-8"))

            duration_sec = int(script_data.get("estimated_duration_seconds", 45))
            total_frames = max(60, duration_sec * self.fps)
            hook_end = min(90, self.fps * 3)
            cta_frames = self.fps * 4

            # Trim script payload for the LLM prompt
            slim = {
                "hook": script_data.get("hook"),
                "hook_text_overlay": script_data.get("hook_text_overlay"),
                "body_script": (script_data.get("body_script") or "")[:600],
                "text_overlays": script_data.get("text_overlays", [])[:8],
                "cta": script_data.get("cta"),
                "topic": script_data.get("topic"),
                "platform": script_data.get("platform"),
            }

            prompt = COMPOSITION_PROMPT.format(
                script_json=json.dumps(slim, indent=2),
                fps=self.fps,
                hook_end=hook_end,
                cta_frames=cta_frames,
                total_frames=total_frames,
            )
            system = (
                "You are a senior Remotion developer who writes clean, compile-ready "
                "React + TypeScript for short-form vertical video. Output ONLY valid TSX."
            )

            tsx = await self.llm.generate(prompt, system=system, complexity="high")

            # Clean markdown wrapping
            if "```tsx" in tsx:
                tsx = tsx.split("```tsx")[1].split("```")[0].strip()
            elif "```typescript" in tsx:
                tsx = tsx.split("```typescript")[1].split("```")[0].strip()
            elif "```" in tsx:
                tsx = tsx.split("```")[1].split("```")[0].strip()

            if "export" not in tsx or "MyVideo" not in tsx:
                self.current_task = None
                return self.emit("skipped", f"Invalid TSX output for {target.name}")

            # Build the project layout
            project_slug = target.stem  # e.g. "ai-side-hustles-tiktok-0001"
            out_root = ensure_output_dir("videos") / project_slug
            (out_root / "src").mkdir(parents=True, exist_ok=True)
            (out_root / "out").mkdir(parents=True, exist_ok=True)

            (out_root / "src" / "MyVideo.tsx").write_text(tsx, encoding="utf-8")
            (out_root / "src" / "index.ts").write_text(INDEX_TS, encoding="utf-8")
            (out_root / "src" / "Root.tsx").write_text(
                ROOT_TS.replace("{DURATION_FRAMES}", str(total_frames))
                       .replace("{FPS}", str(self.fps)),
                encoding="utf-8",
            )
            (out_root / "package.json").write_text(PACKAGE_JSON, encoding="utf-8")

            # Render recipe (from the MaverickGPT TikTok)
            readme = (
                f"# Video Project: {script_data.get('topic', 'untitled')}\n\n"
                f"**Platform:** {script_data.get('platform')}\n"
                f"**Niche:** {script_data.get('niche_name')}\n"
                f"**Duration:** {duration_sec}s ({total_frames} frames @ {self.fps}fps)\n\n"
                f"## Render\n\n"
                f"```bash\ncd {project_slug}\nnpm install\nnpm run render\n```\n\n"
                f"Output MP4 will be at `out/video.mp4`.\n\n"
                f"## Edit in Remotion Studio\n\n"
                f"```bash\nnpm start\n```\n\n"
                f"Opens a live preview at http://localhost:3000 — edit `src/MyVideo.tsx`, "
                f"save, and the preview hot-reloads. Matches the MaverickGPT TikTok workflow.\n"
            )
            (out_root / "README.md").write_text(readme, encoding="utf-8")

            self.produced_scripts.add(target.name)

            # Advance content pipeline: created → scheduled
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "content",
                        f"Video: {script_data.get('topic', '')[:50]}",
                        subtitle=f"Remotion project / {script_data.get('platform', '?')}",
                        stage="scheduled",
                        score=75,
                        metadata={
                            "project_dir": project_slug,
                            "source_script": target.name,
                            "duration_frames": total_frames,
                            "fps": self.fps,
                            "platform": script_data.get("platform"),
                        },
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.current_task = None

            return self.emit(
                "completed",
                f"Remotion project → videos/{project_slug}/ ({total_frames} frames)"
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Video produce failed for {target.name}: {e}")

    def get_tools(self) -> list[dict]:
        return []
