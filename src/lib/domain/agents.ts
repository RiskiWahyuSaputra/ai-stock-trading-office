import type { AgentId, AgentStatus } from "./schemas";

export interface AgentProfile {
  id: AgentId;
  name: string;
  title: string;
  role: string;
  /** Primary identity color (shirt, desk accent, name tag). */
  color: string;
  hair: string;
  skin: string;
  /** Workflow status this agent shows while doing its own stage. */
  workingStatus: AgentStatus;
  responsibilities: string[];
  outputs: string[];
}

export const AGENTS: Record<AgentId, AgentProfile> = {
  news: {
    id: "news",
    name: "PS",
    title: "News Researcher AI",
    role: "Riset fundamental & berita pasar",
    color: "#60a5fa",
    hair: "#2b1d16",
    skin: "#e0b48f",
    workingStatus: "researching",
    responsibilities: [
      "Mengumpulkan berita saham yang dipilih",
      "Mengklasifikasi sentimen berita",
      "Mencatat katalis & risiko berita",
    ],
    outputs: ["Ringkasan berita", "Sentimen", "Katalis", "Risiko berita"],
  },
  technical: {
    id: "technical",
    name: "Kikio",
    title: "Technical Analyst AI",
    role: "Analisis tren, indikator & level harga",
    color: "#22d3ee",
    hair: "#111111",
    skin: "#c99a74",
    workingStatus: "analyzing",
    responsibilities: [
      "Membaca tren dari data candle",
      "Menghitung RSI, MACD, MA, ATR, volume",
      "Menentukan support/resistance, entry, SL, TP",
    ],
    outputs: ["Arah tren", "Area entry", "Invalidasi", "Kandidat SL/TP"],
  },
  risk: {
    id: "risk",
    name: "Kiyu",
    title: "Risk Manager AI",
    role: "Kelayakan & manajemen risiko",
    color: "#f59e0b",
    hair: "#5a3a22",
    skin: "#a87553",
    workingStatus: "risk_checking",
    responsibilities: [
      "Menghitung risk/reward secara deterministik",
      "Menilai volatilitas & gap",
      "Menolak skenario yang tidak konsisten",
    ],
    outputs: ["R/R ratio", "Risiko per posisi", "Status kelayakan"],
  },
  reviewer: {
    id: "reviewer",
    name: "Kisa",
    title: "Signal Reviewer AI",
    role: "Supervisor konsistensi antar-agen",
    color: "#a78bfa",
    hair: "#3b2a1e",
    skin: "#f1c7a3",
    workingStatus: "reviewing",
    responsibilities: [
      "Membandingkan sentimen berita vs tren",
      "Memeriksa kelengkapan data & timestamp",
      "Mengembalikan pekerjaan ke agen terkait",
    ],
    outputs: ["Approved", "Needs review", "Conflicting", "Insufficient data"],
  },
  officer: {
    id: "officer",
    name: "Kisaki",
    title: "Final Signal Officer AI",
    role: "Laporan final & notifikasi",
    color: "#22c55e",
    hair: "#1a1a1a",
    skin: "#b98563",
    workingStatus: "finalizing",
    responsibilities: [
      "Menggabungkan hasil seluruh agen",
      "Menetapkan BUY/SELL SETUP, WAIT, NO TRADE",
      "Mengirim notifikasi laporan",
    ],
    outputs: ["Final signal report", "Notifikasi"],
  },
};

export const AGENT_ORDER: AgentId[] = ["news", "technical", "risk", "reviewer", "officer"];

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  researching: "Researching",
  analyzing: "Analyzing",
  risk_checking: "Risk Checking",
  reviewing: "Reviewing",
  finalizing: "Finalizing",
  completed: "Completed",
  failed: "Failed",
  needs_attention: "Needs Attention",
};

export const ACTIVE_STATUSES: AgentStatus[] = [
  "researching",
  "analyzing",
  "risk_checking",
  "reviewing",
  "finalizing",
];

export function isWorking(status: AgentStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export const DISCLAIMER =
  "Analisis ini bersifat informasional untuk membantu pengambilan keputusan, bukan saran investasi dan bukan jaminan hasil. Keputusan dan risiko trading sepenuhnya milik pengguna.";
