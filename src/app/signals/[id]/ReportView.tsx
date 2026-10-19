"use client";

import { ArrowLeft, FileX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FinalSignalReport } from "@/components/report/FinalSignalReport";
import { EmptyState } from "@/components/ui/primitives";
import { useHydrated } from "@/hooks/useHydrated";
import { useOffice } from "@/lib/store/office-store";

export function ReportView() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const report = useOffice((s) => s.reports.find((r) => r.id === id));

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <Link href="/signals" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Final Signals
      </Link>
      {report ? (
        <FinalSignalReport report={report} />
      ) : hydrated ? (
        <EmptyState icon={<FileX className="size-8" />} title="Laporan tidak ditemukan">
          Laporan disimpan di perangkat ini. Mungkin sudah dihapus atau dibuat di browser lain.
        </EmptyState>
      ) : (
        <p className="py-16 text-center text-xs text-subtle">Memuat laporan…</p>
      )}
    </div>
  );
}
