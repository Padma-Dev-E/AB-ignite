import type { ReactNode } from "react";

export function Button({ children, variant = "secondary", size = "default", className = "", type = "button", disabled = false, onClick }: { children: ReactNode; variant?: "primary" | "secondary"; size?: "default" | "small"; className?: string; type?: "button" | "submit" | "reset"; disabled?: boolean; onClick?: () => void }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`${variant === "primary" ? "btn-primary" : "btn"} ${size === "small" ? "btn-small" : ""} ${className}`}>{children}</button>;
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={`app-card ${className}`}>{children}</Tag>;
}

export function Field({ label, value, placeholder, type = "text", onChange, multiline = false, className = "", required = false }: { label: string; value?: string; placeholder?: string; type?: string; onChange?: (value: string) => void; multiline?: boolean; className?: string; required?: boolean }) {
  return <label className={`block ${className}`}><span className="field-label">{label}</span>{multiline ? <textarea className="input min-h-[90px] resize-y" value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} required={required} /> : <input className="input" type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} required={required} />}</label>;
}

export function IconBox({ children, tone = "blue", className = "" }: { children: ReactNode; tone?: "blue" | "sand" | "teal"; className?: string }) {
  const tones = { blue: { color: "var(--blue)", background: "rgba(30,94,255,.12)" }, sand: { color: "var(--sand)", background: "rgba(217,119,6,.12)" }, teal: { color: "var(--teal)", background: "rgba(14,159,122,.12)" } };
  return <span className={`icon-box ${className}`} style={tones[tone]}>{children}</span>;
}

export function SectionHeading({ title, detail }: { title: string; detail?: ReactNode }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-xl font-medium">{title}</h2>{detail && <span className="text-sm text-muted">{detail}</span>}</div>;
}

export function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return <div className="tile text-center"><b className="block text-xl font-semibold">{value}</b><span className="text-xs text-muted">{label}</span></div>;
}
