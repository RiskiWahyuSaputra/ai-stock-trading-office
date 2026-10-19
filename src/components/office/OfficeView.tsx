"use client";

import { Box, Crosshair, LayoutGrid, Maximize2, Radar } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import { useOffice } from "@/lib/store/office-store";
import type { AgentId } from "@/lib/domain/schemas";
import { cn } from "@/lib/utils";
import { useOfficeCamera } from "./camera-store";
import { Office2D } from "./Office2D";

const OfficeScene = dynamic(() => import("./OfficeScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-accent" />{" "}
        Menyiapkan kantor 3D…
      </div>
    </div>
  ),
});

let webglSupport: boolean | undefined;
function detectWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(
        canvas.getContext("webgl2") || canvas.getContext("webgl")
      );
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

/** Falls back to 2D if the WebGL scene throws at runtime (e.g. context lost). */
class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function OfficeView({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const view = useOffice((s) => s.settings.view);
  const updateSettings = useOffice((s) => s.updateSettings);
  const selectAgent = useOffice((s) => s.selectAgent);
  const { followActive, setFollow, focusOn } = useOfficeCamera();
  // null on the server; detected once on the client.
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => null);

  const open = (id: AgentId) => {
    selectAgent(id);
    focusOn(id);
  };

  const use3D = webgl === true && view !== "2d";
  const fallback = <Office2D onOpenAgent={open} />;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-line bg-bg",
        className,
      )}
    >
      {webgl === null ? null : use3D ? (
        <SceneBoundary fallback={fallback}>
          {<OfficeScene onOpenAgent={open} />}
        </SceneBoundary>
      ) : (
        fallback
      )}

      {webgl === false && (
        <div className="absolute inset-x-3 top-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Perangkat tidak mendukung WebGL — menampilkan tampilan 2D.
        </div>
      )}

      <div
        className={cn(
          "absolute flex gap-1.5",
          compact ? "bottom-2 right-2" : "bottom-3 right-3",
        )}
      >
        {use3D && (
          <>
            <OverlayButton
              active={followActive}
              onClick={() => setFollow(!followActive)}
              label={
                followActive
                  ? "Kamera mengikuti agen aktif"
                  : "Ikuti agen aktif"
              }
            >
              <Radar className="size-4" />
            </OverlayButton>
            <OverlayButton
              onClick={() => {
                selectAgent(null);
                focusOn(null);
              }}
              label="Reset kamera"
            >
              <Maximize2 className="size-4" />
            </OverlayButton>
          </>
        )}
        {webgl && (
          <OverlayButton
            onClick={() => updateSettings({ view: use3D ? "2d" : "3d" })}
            label={use3D ? "Tampilan 2D" : "Tampilan 3D"}
          >
            {use3D ? (
              <LayoutGrid className="size-4" />
            ) : (
              <Box className="size-4" />
            )}
          </OverlayButton>
        )}
      </div>
      {use3D && !compact && (
        <div className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-1.5 rounded-md bg-bg/70 px-2 py-1 text-[11px] text-subtle sm:flex">
          <Crosshair className="size-3" /> Drag untuk memutar · scroll untuk
          zoom · klik karyawan untuk detail
        </div>
      )}
    </div>
  );
}

function OverlayButton({
  children,
  onClick,
  label,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "glass grid size-9 place-items-center rounded-lg transition-colors hover:text-fg",
        active ? "text-accent" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}
