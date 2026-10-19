"use client";

import { useState } from "react";
import { RiskAssessmentPanel } from "@/components/report/RiskAssessmentPanel";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { HIGH_GAP_PCT, HIGH_VOL_PCT, MIN_RR } from "@/lib/agents/risk-manager";
import { ATR_MULT } from "@/lib/agents/technical-analyst";
import { positionSize, riskReward, validateLevels } from "@/lib/analysis/risk";
import type { Market } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { formatMoney } from "@/lib/utils";

function NumberField({ label, value, onChange, step = "any" }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular h-9 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm focus:border-accent focus:outline-none"
      />
    </label>
  );
}

/** Position calculator built on the same validated functions the Risk Manager uses. */
function PositionCalculator() {
  const settings = useOffice((s) => s.settings);
  const [market, setMarket] = useState<Market>(settings.market);
  const [account, setAccount] = useState(String(settings.accountSize[settings.market]));
  const [riskPct, setRiskPct] = useState(String(settings.riskPct));
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  const n = (v: string) => Number(v);
  const ready = [account, riskPct, entry, sl, tp].every((v) => v !== "" && Number.isFinite(n(v)) && n(v) > 0);
  const side = n(sl) < n(entry) ? "long" : "short";
  const zone = { low: n(entry), high: n(entry) };
  const check = ready ? validateLevels(side, zone, n(sl), [n(tp)]) : null;
  let result: { rr: number; pos: ReturnType<typeof positionSize> } | null = null;
  let error: string | null = null;
  if (ready && check?.valid) {
    try {
      result = {
        rr: riskReward(side, zone, n(sl), [n(tp)]).ratios[0],
        pos: positionSize({ market, accountSize: n(account), riskPct: n(riskPct), entry: n(entry), stopLoss: n(sl) }),
      };
    } catch (e) {
      error = (e as Error).message;
    }
  }

  return (
    <Panel>
      <PanelHeader title="Kalkulator posisi" subtitle="Perhitungan deterministik — sama dengan yang dipakai Risk Manager AI." />
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <Segmented label="Pasar" value={market} onChange={setMarket} options={[{ value: "IDX", label: "IDX (lot 100)" }, { value: "US", label: "US" }]} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Modal" value={account} onChange={setAccount} />
            <NumberField label="Risiko per trade (%)" value={riskPct} onChange={setRiskPct} />
            <NumberField label="Entry" value={entry} onChange={setEntry} />
            <NumberField label="Stop loss" value={sl} onChange={setSl} />
            <NumberField label="Take profit" value={tp} onChange={setTp} />
          </div>
        </div>
        <div className="rounded-lg bg-panel-2 p-4 text-sm">
          {!ready ? (
            <p className="text-xs text-muted">Isi semua kolom dengan angka positif.</p>
          ) : check && !check.valid ? (
            <ul className="space-y-1 text-xs text-warn">
              {check.issues.map((i) => (
                <li key={i}>! {i}</li>
              ))}
            </ul>
          ) : error ? (
            <p className="text-xs text-bear">{error}</p>
          ) : result ? (
            <dl className="tabular space-y-2">
              <div className="flex justify-between"><dt className="text-muted">Arah</dt><dd className="font-medium">{side === "long" ? "Long" : "Short"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Risk/reward</dt><dd className="font-medium">{result.rr.toFixed(2)}R</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Maks rugi</dt><dd className="font-medium text-bear">{formatMoney(result.pos.maxLoss, market)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Ukuran</dt><dd className="font-medium">{result.pos.lots !== null ? `${result.pos.lots} lot (${result.pos.shares} saham)` : `${result.pos.shares} saham`}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Nilai posisi</dt><dd className="font-medium">{formatMoney(result.pos.positionValue, market)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Potensi profit di TP</dt><dd className="font-medium text-bull">{formatMoney(Math.abs(n(tp) - n(entry)) * result.pos.shares, market)}</dd></div>
              {result.pos.shares === 0 && <p className="text-xs text-warn">Modal/risiko terlalu kecil untuk satu {market === "IDX" ? "lot" : "saham"} pada jarak stop ini.</p>}
            </dl>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export default function RiskPage() {
  const reports = useOffice((s) => s.reports);
  const latest = reports[0];

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader title="Risk Management" description="Aturan yang dipakai Risk Manager AI dan alat bantu perhitungan risiko." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Aturan aktif" subtitle="Skenario di luar aturan ditolak atau diberi status perlu perhatian." />
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="pb-2 font-medium">Mode</th>
                  <th className="pb-2 text-right font-medium">Min R/R (TP2)</th>
                  <th className="pb-2 text-right font-medium">Stop (×ATR)</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {(Object.keys(MIN_RR) as (keyof typeof MIN_RR)[]).map((m) => (
                  <tr key={m}>
                    <td className="py-2 capitalize">{m}</td>
                    <td className="py-2 text-right">{MIN_RR[m]}</td>
                    <td className="py-2 text-right">{ATR_MULT[m]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="pb-2 font-medium">Timeframe</th>
                  <th className="pb-2 text-right font-medium">Batas volatilitas</th>
                  <th className="pb-2 text-right font-medium">Batas gap</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {(Object.keys(HIGH_VOL_PCT) as (keyof typeof HIGH_VOL_PCT)[]).map((tf) => (
                  <tr key={tf}>
                    <td className="py-2">{tf}</td>
                    <td className="py-2 text-right">{HIGH_VOL_PCT[tf]}%</td>
                    <td className="py-2 text-right">{HIGH_GAP_PCT[tf]}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-4 space-y-1 text-xs text-muted">
              <li>• TP1 di bawah 1R → status perlu perhatian.</li>
              <li>• Harga terakhir &gt; 1R dari area entry → perlu perhatian.</li>
              <li>• Level entry/SL/TP yang tidak konsisten → ditolak.</li>
              <li>• Data kedaluwarsa atau kurang → NO TRADE.</li>
            </ul>
          </div>
        </Panel>
        <PositionCalculator />
      </div>
      {latest && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">
            Penilaian terakhir · {latest.request.symbol} {latest.request.timeframe}
          </h2>
          <RiskAssessmentPanel report={latest} />
        </div>
      )}
    </div>
  );
}
