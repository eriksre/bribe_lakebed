import { Link } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

export function Card({ action, children, description, title }: { action?: ComponentChildren; children: ComponentChildren; description?: string; title: string }) {
  return (
    <section className="bribe-surface rounded-xl border bg-white">
      <header className="grid gap-1 border-b p-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <h2 className="text-balance text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-pretty text-sm text-neutral-600">{description}</p> : null}
        </div>
        {action ? <div className="mt-2 sm:mt-0">{action}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Modal({ children, description, onClose, title }: { children: ComponentChildren; description?: string; onClose: () => void; title: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="bribe-surface mx-auto flex w-full max-w-4xl flex-col rounded-xl border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b p-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-pretty text-sm text-neutral-600">{description}</p> : null}
          </div>
          <button
            aria-label="Close"
            className="bribe-button bribe-surface bribe-surface-hover grid size-9 shrink-0 place-items-center rounded-md border bg-white text-sm hover:bg-neutral-50"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export function ButtonLink({ children, href, variant = "default" }: { children: ComponentChildren; href: string; variant?: "default" | "secondary" }) {
  const className = variant === "default"
    ? "bribe-button inline-flex h-10 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
    : "bribe-button bribe-surface bribe-surface-hover inline-flex h-10 items-center justify-center rounded-md border bg-white px-3.5 text-sm font-medium hover:bg-neutral-50";
  return <Link className={className} to={href}>{children}</Link>;
}

export function AsyncButton({
  children,
  className,
  errorTitle = "Action failed",
  pendingLabel = "Working",
  run,
}: {
  children: ComponentChildren;
  className: string;
  errorTitle?: string;
  pendingLabel?: string;
  run: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function execute() {
    setPending(true);
    setError("");
    try {
      await run();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-grid gap-2">
      <button className={`bribe-button ${className} disabled:opacity-60`} disabled={pending} type="button" onClick={() => void execute()}>{pending ? pendingLabel : children}</button>
      {error ? <span className="max-w-56 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800"><span className="font-medium">{errorTitle}: </span>{error}</span> : null}
    </span>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bribe-surface bribe-surface-hover rounded-xl border bg-white p-3.5">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="bribe-tabular mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function CampaignMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-xs font-medium uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

export function Status({ children, className = "", tone }: { children: ComponentChildren; className?: string; tone: "good" | "neutral" | "bad" | "muted" }) {
  const tones = {
    good: "border-neutral-950 bg-neutral-950 text-white",
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-900",
    bad: "border-red-200 bg-red-50 text-red-700",
    muted: "border-neutral-300 bg-white text-neutral-600",
  };
  return <span className={`inline-flex min-h-7 max-w-full shrink-0 items-center rounded-md border px-2 py-1 text-xs font-medium leading-tight ${tones[tone]} ${className}`}>{children}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
      <div className="h-full bg-neutral-950 transition-[width] duration-300 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="bribe-surface min-w-0 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-tight">{label}</p>
      <span className="bribe-tabular font-mono text-sm">{value}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

export function PhotoPreview({ compact = false, src }: { compact?: boolean; src?: string }) {
  const className = `bribe-image relative overflow-hidden rounded-lg border bg-neutral-100 ${compact ? "aspect-[4/3]" : "aspect-[4/5]"}`;
  if (!src) {
    return <div className={`${className} grid place-items-center text-sm text-neutral-500`}>No media</div>;
  }
  if (src.startsWith("data:video/")) {
    return <video className={`${className} w-full object-cover`} controls src={src} />;
  }
  return <img alt="Customer submission" className={`${className} w-full object-cover`} src={src} />;
}

export function DataTable({ columns, rows }: { columns: string[]; rows: ComponentChildren[][] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>{columns.map((column) => <th className="border-b px-3 py-2 font-medium" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b last:border-b-0" key={rowIndex}>
              {row.map((cell, cellIndex) => <td className="px-3 py-2 align-middle" key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => Promise<unknown> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!confirm("Delete this item?")) return;
    setPending(true);
    setError("");
    try {
      await onDelete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-grid gap-2">
      <button className="bribe-button bribe-surface bribe-surface-hover h-10 rounded-md border bg-white px-3.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60" disabled={pending} type="button" onClick={() => void run()}>{pending ? "Deleting" : label}</button>
      {error ? <span className="max-w-48 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">{error}</span> : null}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="bribe-surface rounded-xl border p-4 text-pretty text-sm text-neutral-600">{text}</div>;
}

export function Alert({ children, title, tone = "neutral" }: { children: ComponentChildren; title: string; tone?: "neutral" | "bad" }) {
  return (
    <div className={`bribe-surface rounded-lg border p-3 text-sm ${tone === "bad" ? "border-red-200 bg-red-50 text-red-800" : "bg-neutral-50 text-neutral-800"}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-pretty leading-5">{children}</p>
    </div>
  );
}

export function CheckLine({ checked, children }: { checked?: boolean; children: ComponentChildren }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="grid size-5 place-items-center rounded-md border bg-white">{checked ? "✓" : "·"}</span>
      <span className={checked ? "" : "text-neutral-600"}>{children}</span>
    </div>
  );
}

export function Detail({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="bribe-surface rounded-lg border p-3">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className={`mt-1 font-medium ${mono ? "bribe-tabular font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export function ReadOnlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      <textarea className="bribe-field min-h-24 w-full rounded-md border bg-neutral-50 p-3 text-sm" readOnly value={value} />
    </div>
  );
}

export function Field({ defaultValue = "", inputMode, label, name, placeholder, required = false }: { defaultValue?: string; inputMode?: "numeric"; label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={name}>{label}</label>
      <input className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm" defaultValue={defaultValue} id={name} inputMode={inputMode} name={name} placeholder={placeholder} required={required} />
    </div>
  );
}

export function TextAreaField({ defaultValue = "", label, name, required = false, rows = 4 }: { defaultValue?: string; label: string; name: string; required?: boolean; rows?: number }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={name}>{label}</label>
      <textarea className="bribe-field w-full rounded-md border bg-white p-3 text-sm" defaultValue={defaultValue} id={name} name={name} required={required} rows={rows} />
    </div>
  );
}

export function SelectField({ defaultValue, label, name, options }: { defaultValue: string; label: string; name: string; options: Array<[string, string]> }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={name}>{label}</label>
      <select className="bribe-field h-10 w-full rounded-md border bg-white px-3 text-sm" defaultValue={defaultValue} id={name} name={name}>
        {options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </div>
  );
}
