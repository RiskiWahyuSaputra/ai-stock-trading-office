import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { PageHeader } from "@/components/ui/primitives";

export default function WatchlistPage() {
  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader title="Watchlist" description="Saham yang Anda pantau beserta sinyal terakhir dari tim AI." />
      <WatchlistPanel />
    </div>
  );
}
