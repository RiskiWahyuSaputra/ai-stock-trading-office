# AI Stock Trading Office

Kantor virtual 3D berisi tim analis saham AI. Pengguna berperan sebagai CEO yang memberi tugas analisis, lalu melihat lima karyawan AI mengerjakannya secara langsung, dari riset berita sampai laporan final berisi entry, stop loss, take profit, dan risk/reward.

> **Penting:** aplikasi ini hanya menghasilkan analisis informasional. Tidak ada eksekusi transaksi.

## Sumber data

| Data | Default | Catatan |
|---|---|---|
| Harga & candle (IDX + US) | **Yahoo Finance** via `yahoo-finance2` | Data asli, **delayed** oleh bursa (IDX ±10 menit). API tidak resmi, tanpa API key, bisa berubah sewaktu-waktu. |
| Berita saham US | Yahoo Finance News | Hanya judul, penerbit, waktu, dan tautan. |
| Berita saham IDX | Google News RSS (bahasa Indonesia) | Judul berita yang menyebut kode saham, 7 hari terakhir. |
| Mode offline | Simulator DEMO | `MARKET_DATA_PROVIDER=demo`, `NEWS_PROVIDER=demo`. Semua nilai diberi label DEMO. |

Tidak ada fallback diam-diam: jika Yahoo atau Google gagal, analisis dihentikan dengan pesan error. Aplikasi tidak beralih ke data simulasi tanpa pemberitahuan. Harga diambil saat dibutuhkan (tidak di-stream), sehingga price alert tetap nonaktif.

## Fitur

- **Kantor 3D interaktif** (React Three Fiber): lima meja dengan monitor sesuai peran. Karakter bergerak sesuai status kerja (mengetik, membaca, menunjuk chart, merayakan, bermasalah). Ada name tag dengan status dan progress, kamera bisa di-zoom/drag dan otomatis mengikuti agen yang aktif. Tersedia fallback 2D bila WebGL tidak didukung.
- **Workflow agen yang benar-benar berjalan**: `POST /api/analysis` men-stream event NDJSON di setiap batas tahap. Animasi kantor digerakkan oleh event ini, bukan timer palsu. Signal Reviewer bisa mengembalikan pekerjaan ke Technical Analyst.
- **Lima karyawan AI**: News Researcher, Technical Analyst, Risk Manager, Signal Reviewer, Final Signal Officer.
- **Final Signal Report**: BUY SETUP / SELL SETUP / WAIT / NO TRADE, entry zone, SL, TP1–3, R/R, ukuran posisi, skor konfluensi beserta faktornya, kondisi invalidasi, risiko, dan team review. Setiap bagian ditandai sebagai *fakta data*, *hasil perhitungan*, atau *interpretasi agen*. Laporan bisa di-copy dan di-export ke `.md`/`.json`.
- **Halaman lain**: Analyze Stock (autocomplete, timeline progres, chart candlestick), Watchlist, Final Signals, Analysis History, News Center, Risk Management (tabel aturan + kalkulator posisi), Notification Center, Settings.

## Prinsip keamanan finansial

- Semua angka (jarak entry/SL/TP, R/R, ukuran posisi) dihitung oleh fungsi deterministik yang punya unit test (`src/lib/analysis/risk.ts`), bukan teks buatan model.
- Level harga hanya dihitung dari data candle, dan setiap level mencantumkan metodenya.
- Skor konfluensi **bukan** probabilitas profit. Skor dibatasi maksimal 90, dan maksimal 55 jika reviewer belum memberi approve.
- Data kurang atau kedaluwarsa menghasilkan NO TRADE. Konflik antara berita dan teknikal menghasilkan WAIT.
- Price alert hanya aktif jika provider menyediakan feed harga live. Di mode DEMO, alert disimpan dalam keadaan **tidak aktif** dan notifikasi harga real-time tidak disimulasikan.

## Arsitektur

```
src/
  app/                 # Halaman (App Router) + route handler /api/*
  components/
    office/            # OfficeScene, EmployeeCharacter, EmployeeDesk, NameTags, Office2D, ...
    report/            # FinalSignalCard, FinalSignalReport, RiskAssessmentPanel, AgentResults
    analysis/          # StockSearch, AgentWorkflow, AnalyzeStock
    charts/ news/ watchlist/ notifications/ shell/ ui/
  lib/
    domain/            # Skema zod + profil agen
    analysis/          # Indikator & matematika risiko (pure, teruji)
    agents/            # Logika tiap karyawan AI (pure, teruji)
    api/ store/        # Client API tervalidasi + store zustand
  server/
    providers/         # Interface MarketDataProvider/NewsProvider + simulator DEMO
    workflow/engine.ts # Koordinasi agen, streaming event
```

Pemisahan tanggung jawab: pengambilan data pasar, pengambilan berita, analisis, perhitungan risiko, review, laporan final, dan notifikasi berada di modul yang berbeda.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit test (vitest)
npm run lint && npm run typecheck && npm run build
```

## Menambah provider lain

1. Implementasikan `MarketDataProvider` / `NewsProvider` (`src/server/providers/types.ts`).
2. Daftarkan di `src/server/providers/index.ts`.
3. Atur `MARKET_DATA_PROVIDER` / `NEWS_PROVIDER` serta API key di `.env.local` (lihat `.env.example`). Secret hanya dibaca di server.

Integrasi LLM belum diimplementasikan. Sentimen berita memakai leksikon kata kunci bahasa Inggris dan Indonesia yang hanya menilai judul, sehingga konteks dan negasi tidak dipahami. Beberapa artikel tentang peristiwa yang sama juga masih dihitung terpisah. Fungsi `classify` di `news-researcher.ts` adalah titik penggantinya.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · React Three Fiber + drei · Recharts · Zustand · Zod · Vitest

---

Disclaimer: analisis ini bersifat informasional, bukan saran investasi dan bukan jaminan hasil.
