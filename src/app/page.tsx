"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { EmployeeDetailPanel } from "@/components/office/EmployeeDetailPanel";
import { OfficeActivityFeed } from "@/components/office/OfficeActivityFeed";
import { OfficeOverviewPanel } from "@/components/office/OfficeOverviewPanel";
import { OfficeView } from "@/components/office/OfficeView";
import { FinalSignalCard } from "@/components/report/FinalSignalCard";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { useOffice } from "@/lib/store/office-store";

export default function OfficeOverviewPage() {
  const selected = useOffice((s) => s.selectedAgent);
  const selectAgent = useOffice((s) => s.selectAgent);
  const latest = useOffice((s) => s.reports[0]);
  const run = useOffice((s) => s.run);

  return (
    <div className="page-enter flex min-h-full flex-col gap-4 p-3 sm:p-4 xl:h-full">
      <OfficeOverviewPanel />
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative h-[60vh] min-h-[380px] xl:h-auto xl:min-h-0">
          <OfficeView className="h-full" />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
            <Link
              href="/analyze"
              className="glass pointer-events-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-fg hover:border-accent/60"
            >
              <Play className="size-3.5 text-accent" />
              {run?.phase === "running" ? `Menganalisis ${run.request.symbol}…` : "Beri tugas analisis"}
            </Link>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          {selected ? (
            <EmployeeDetailPanel id={selected} onClose={() => selectAgent(null)} />
          ) : (
            <>
              {latest && <FinalSignalCard report={latest} fromOffice />}
              <Panel className="flex min-h-0 flex-1 flex-col">
                <PanelHeader title="Activity Timeline" subtitle="Event nyata dari workflow agen" />
                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
                  <OfficeActivityFeed limit={40} />
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
