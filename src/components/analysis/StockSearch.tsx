"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Market, StockInfo } from "@/lib/domain/schemas";
import { cn } from "@/lib/utils";

/** Symbol input with autocomplete from the active market data provider. */
export function StockSearch({
  value,
  market,
  onChange,
  onSelect,
}: {
  value: string;
  market: Market;
  onChange: (v: string) => void;
  onSelect: (s: StockInfo) => void;
}) {
  const [results, setResults] = useState<StockInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.symbols(value, market, ctrl.signal);
        setResults(res.results);
        setError(null);
        setHighlight(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Gagal memuat daftar simbol.");
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, market, open]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (s: StockInfo) => {
    onSelect(s);
    setOpen(false);
  };

  return (
    <div className="relative" ref={box}>
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-xs font-medium text-muted">
        Simbol saham
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          placeholder={market === "IDX" ? "mis. BBCA" : "mis. NVDA"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + results.length) % results.length);
            } else if (e.key === "Enter" && results[highlight]) {
              e.preventDefault();
              choose(results[highlight]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-10 w-full rounded-lg border border-line-strong bg-bg pl-9 pr-9 text-sm uppercase placeholder:normal-case placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle" />}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="scrollbar-thin absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-panel py-1 shadow-2xl shadow-black/50">
          {error ? (
            <li className="px-3 py-2 text-xs text-bear">{error}</li>
          ) : results.length === 0 && !loading ? (
            <li className="px-3 py-2 text-xs text-muted">Simbol tidak ditemukan di pasar {market}.</li>
          ) : (
            results.map((s, i) => (
              <li
                key={s.symbol}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", i === highlight && "bg-panel-2")}
              >
                <span className="w-14 font-semibold">{s.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{s.name}</span>
                <span className="text-[10px] text-subtle">{s.sector}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
