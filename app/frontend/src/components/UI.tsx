import { useEffect } from "react";
import type { ReactNode } from "react";
import type { DemoVehiclePosition } from "../demo";
import { Icon } from "./Icon";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, footnote, icon, tone = "blue" }: { label: string; value: string | number; footnote?: ReactNode; icon: string; tone?: "blue" | "cyan" | "red" | "green" | "slate" | "amber" }) {
  return <article className="stat-card"><div className="stat-label">{label}<span className={`stat-icon ${tone}`}><Icon name={icon} /></span></div><strong className="stat-value">{value}</strong>{footnote && <div className="stat-footnote">{footnote}</div>}</article>;
}

const labels: Record<string, string> = { created: "Created", assigned: "Assigned", dispatched: "Dispatched", in_transit: "In Transit", delayed: "Delayed", delivered: "Delivered", cancelled: "Cancelled", available: "Available", on_delivery: "On Route", in_use: "Active", maintenance: "Maintenance", unavailable: "Unavailable" };
export function StatusBadge({ status }: { status: string }) { return <span className={`status-badge status-${status}`}><i />{labels[status] ?? status.replaceAll("_", " ")}</span>; }

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></header>{children}</section></div>;
}

export function FleetMap({ positions, selectedId, onSelect, compact = false }: { positions: DemoVehiclePosition[]; selectedId?: string; onSelect?: (position: DemoVehiclePosition) => void; compact?: boolean }) {
  return <div className={`fleet-map ${compact ? "map-compact" : ""}`}>
    <svg className="map-roads" viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true">
      <path className="river" d="M290 -20 C320 70 310 150 280 220 C260 280 305 330 330 390 C350 440 350 500 380 530" />
      <path className="road" d="M65 65 150 180 270 300 330 455M200 42 215 280 330 455M270 300 420 215 555 205 555 430 330 455M270 300 420 215 450 95" />
      <path className="road road-secondary" d="M150 180 215 280 365 260 420 215M330 455 350 500M65 65 105 98" />
      {[[72, 57, "Madison"], [200, 38, "Milwaukee"], [150, 180, "Rockford"], [270, 300, "Chicago"], [400, 215, "Kalamazoo"], [460, 91, "Grand Rapids"], [215, 357, "Joliet"], [330, 455, "Indianapolis"], [555, 430, "Columbus"], [555, 205, "Detroit"]].map(([x, y, label]) => <g key={label as string} className="map-city"><circle cx={x as number} cy={y as number} r="2"/><text x={x as number} y={(y as number) + 17}>{label}</text></g>)}
    </svg>
    <div className="map-water-label">Simulated positions · not live GPS</div>
    {positions.map((point) => <button key={point.id} type="button" className={`map-marker marker-${point.state} ${selectedId === point.id ? "selected" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`${point.id}: ${point.driver}, ${point.position}`} title={`${point.id} · ${point.driver}`} onClick={() => onSelect?.(point)}>{selectedId === point.id && <span>{point.id}</span>}</button>)}
    {!compact && <div className="map-legend"><span><i className="legend-active" />Active</span><span><i className="legend-delayed" />Delayed</span><span><i className="legend-available" />Available</span><span><i className="legend-off" />Unavailable</span></div>}
  </div>;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) { return <div className="data-state" role="status"><span className="spinner" />{label}</div>; }
export function EmptyState({ title, description }: { title: string; description?: string }) { return <div className="empty-state"><span className="empty-icon"><Icon name="box" /></span><strong>{title}</strong>{description && <p>{description}</p>}</div>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="error-state" role="alert"><Icon name="alert" /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>; }

