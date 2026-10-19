import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/domain/agents";
import type { AgentStatus, SignalStatus } from "@/lib/domain/schemas";
import { cn, SIGNAL_STYLE } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-panel", className)} {...props} />;
}

export function PanelHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg hover:bg-accent-strong font-semibold",
  secondary: "border border-line-strong bg-panel-2 text-fg hover:border-accent/60",
  ghost: "text-muted hover:bg-panel-2 hover:text-fg",
  danger: "border border-bear/40 bg-bear/10 text-bear hover:bg-bear/20",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", className)}
      {...props}
    />
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn("border-warn/50 bg-warn/10 text-warn tracking-wide", className)} title="Data simulasi — bukan data pasar nyata">
      DEMO
    </Badge>
  );
}

export function SignalBadge({ status, className }: { status: SignalStatus; className?: string }) {
  const s = SIGNAL_STYLE[status];
  return <Badge className={cn(s.className, "font-semibold", className)}>{s.label}</Badge>;
}

export const STATUS_TONE: Record<AgentStatus, string> = {
  idle: "text-subtle border-line bg-panel-2",
  queued: "text-muted border-line-strong bg-panel-2",
  researching: "text-info border-info/40 bg-info/10",
  analyzing: "text-accent border-accent/40 bg-accent/10",
  risk_checking: "text-warn border-warn/40 bg-warn/10",
  reviewing: "text-[#a78bfa] border-[#a78bfa]/40 bg-[#a78bfa]/10",
  finalizing: "text-bull border-bull/40 bg-bull/10",
  completed: "text-bull border-bull/40 bg-bull/10",
  failed: "text-bear border-bear/40 bg-bear/10",
  needs_attention: "text-warn border-warn/40 bg-warn/10",
};

export function StatusPill({ status, className }: { status: AgentStatus; className?: string }) {
  return <Badge className={cn(STATUS_TONE[status], className)}>{STATUS_LABEL[status]}</Badge>;
}

export function ProgressBar({ value, className, tone = "bg-accent" }: { value: number; className?: string; tone?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-panel-2", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-subtle">{label}</div>
      <div className="tabular mt-1 truncate text-lg font-semibold text-fg">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-subtle">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="max-w-sm text-xs text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
