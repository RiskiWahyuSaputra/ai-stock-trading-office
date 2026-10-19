import * as THREE from "three";
import type { AgentId, AgentStatus } from "@/lib/domain/schemas";

/**
 * Monitor content drawn into small canvases. Each role has its own screen
 * style; content animates only while the agent is actually working.
 */

const W = 256;
const H = 160;

export interface ScreenHandle {
  texture: THREE.CanvasTexture;
  draw: (t: number, status: AgentStatus, symbol: string | null) => void;
}

const BG = "#0a1222";
const GRID = "#16233d";

export function createScreen(agent: AgentId, accent: string, index: number): ScreenHandle {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // Stable pseudo-random shape per screen (decorative chart silhouettes).
  const seed = (agent.length * 31 + index * 17) % 97;
  const series = Array.from({ length: 48 }, (_, i) => 0.5 + 0.28 * Math.sin((i + seed) / 5) + 0.12 * Math.sin((i * 7 + seed) / 3));

  const header = (title: string, symbol: string | null) => {
    ctx.fillStyle = "#0f1a30";
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = accent;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(title, 8, 15);
    if (symbol) {
      ctx.fillStyle = "#e6ecf7";
      ctx.textAlign = "right";
      ctx.fillText(symbol, W - 8, 15);
      ctx.textAlign = "left";
    }
  };

  const draw = (t: number, status: AgentStatus, symbol: string | null) => {
    const working = !["idle", "queued", "completed", "failed", "needs_attention"].includes(status);
    const phase = working ? t : 0;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let y = 30; y < H; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (agent === "news") {
      header(index === 0 ? "NEWS FEED" : "SENTIMENT", symbol);
      if (index === 0) {
        const offset = Math.floor(phase * 1.5) % 6;
        for (let i = 0; i < 6; i++) {
          const k = (i + offset) % 6;
          const y = 34 + i * 21;
          ctx.fillStyle = ["#22c55e", "#ef4444", "#8b98b3"][k % 3];
          ctx.fillRect(8, y, 4, 12);
          ctx.fillStyle = "#c9d4e8";
          ctx.fillRect(18, y + 1, 120 + ((k * 37) % 100), 4);
          ctx.fillStyle = "#5d6a85";
          ctx.fillRect(18, y + 8, 80 + ((k * 23) % 90), 3);
        }
      } else {
        const v = 0.5 + 0.35 * Math.sin(phase * 0.8 + seed);
        ctx.fillStyle = "#16233d";
        ctx.fillRect(20, 70, W - 40, 18);
        ctx.fillStyle = v > 0.5 ? "#22c55e" : "#ef4444";
        ctx.fillRect(20, 70, (W - 40) * v, 18);
        ctx.fillStyle = "#8b98b3";
        ctx.font = "11px sans-serif";
        ctx.fillText("negative", 20, 104);
        ctx.textAlign = "right";
        ctx.fillText("positive", W - 20, 104);
        ctx.textAlign = "left";
      }
    } else if (agent === "technical") {
      header(index === 0 ? "CHART" : "RSI · MACD", symbol);
      if (index === 0) {
        const shift = Math.floor(phase * 3);
        const n = 28;
        const bw = (W - 16) / n;
        for (let i = 0; i < n; i++) {
          const a = series[(i + shift) % series.length];
          const b = series[(i + shift + 1) % series.length];
          const up = b >= a;
          const y1 = 140 - a * 100;
          const y2 = 140 - b * 100;
          ctx.strokeStyle = ctx.fillStyle = up ? "#22c55e" : "#ef4444";
          ctx.beginPath();
          ctx.moveTo(8 + i * bw + bw / 2, Math.min(y1, y2) - 6);
          ctx.lineTo(8 + i * bw + bw / 2, Math.max(y1, y2) + 6);
          ctx.stroke();
          ctx.fillRect(8 + i * bw + 1, Math.min(y1, y2), bw - 2, Math.max(2, Math.abs(y2 - y1)));
        }
      } else {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 48; i++) {
          const v = series[(i + Math.floor(phase * 4)) % 48];
          const x = 8 + (i * (W - 16)) / 47;
          const y = 85 - v * 50;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        for (let i = 0; i < 24; i++) {
          const v = series[(i * 2 + Math.floor(phase * 4)) % 48] - 0.5;
          ctx.fillStyle = v > 0 ? "#22c55e" : "#ef4444";
          ctx.fillRect(8 + i * 10, 130, 7, -v * 40);
        }
      }
    } else if (agent === "risk") {
      header(index === 0 ? "RISK METER" : "R/R", symbol);
      if (index === 0) {
        const v = working ? 0.5 + 0.4 * Math.sin(phase * 1.2) : 0.35;
        const cx = W / 2;
        const cy = 130;
        const zones = ["#22c55e", "#f59e0b", "#ef4444"];
        zones.forEach((c, i) => {
          ctx.strokeStyle = c;
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(cx, cy, 80, Math.PI + (i * Math.PI) / 3, Math.PI + ((i + 1) * Math.PI) / 3);
          ctx.stroke();
        });
        const ang = Math.PI + v * Math.PI;
        ctx.strokeStyle = "#e6ecf7";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * 70, cy + Math.sin(ang) * 70);
        ctx.stroke();
      } else {
        const bars = [1, 1.5, 2.5, 3.5];
        bars.forEach((b, i) => {
          const h = (b / 3.5) * 100 * (working ? 0.7 + 0.3 * Math.sin(phase * 2 + i) : 1);
          ctx.fillStyle = i === 0 ? "#ef4444" : "#22c55e";
          ctx.fillRect(30 + i * 52, 145 - h, 34, h);
        });
      }
    } else if (agent === "reviewer") {
      header(index === 0 ? "REVIEW QUEUE" : "CROSS-CHECK", symbol);
      const active = working ? Math.floor(phase * 1.2) % 4 : -1;
      for (let i = 0; i < 4; i++) {
        const y = 32 + i * 31;
        ctx.fillStyle = i === active ? "#1d2b4a" : "#111c33";
        ctx.fillRect(8, y, W - 16, 26);
        ctx.fillStyle = ["#60a5fa", "#22d3ee", "#f59e0b", "#a78bfa"][i];
        ctx.fillRect(14, y + 8, 10, 10);
        ctx.fillStyle = "#c9d4e8";
        ctx.fillRect(32, y + 9, 110 + i * 15, 4);
        const done = status === "completed" || (active >= 0 && i < active);
        ctx.fillStyle = done ? "#22c55e" : "#5d6a85";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(done ? "✓" : "…", W - 26, y + 18);
      }
    } else {
      header(index === 0 ? "FINAL SIGNAL REPORT" : "TEAM STATUS", symbol);
      if (index === 0) {
        ctx.fillStyle = status === "completed" ? "#22c55e" : working ? accent : "#5d6a85";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(status === "completed" ? "REPORT READY" : working ? "COMPILING…" : "STANDBY", 12, 62);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = "#c9d4e8";
          const w = working ? ((phase * 60 + i * 40) % 200) + 20 : 160 - i * 25;
          ctx.fillRect(12, 82 + i * 16, w, 5);
        }
      } else {
        ["NEWS", "TECH", "RISK", "REVIEW"].forEach((l, i) => {
          ctx.fillStyle = "#8b98b3";
          ctx.font = "11px sans-serif";
          ctx.fillText(l, 12, 46 + i * 28);
          ctx.fillStyle = "#16233d";
          ctx.fillRect(70, 38 + i * 28, W - 86, 8);
          ctx.fillStyle = accent;
          ctx.fillRect(70, 38 + i * 28, (W - 86) * (working ? (Math.sin(phase + i) + 1) / 2 : 1), 8);
        });
      }
    }
    texture.needsUpdate = true;
  };

  draw(0, "idle", null);
  return { texture, draw };
}
