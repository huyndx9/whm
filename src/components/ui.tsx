import { forwardRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[#6B7280] mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-[#0F4C5C] text-white hover:bg-[#0d3f4c] disabled:bg-[#9CA3AF]",
    secondary:
      "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] disabled:text-[#9CA3AF]",
    ghost: "text-[#4B5563] hover:bg-[#F3F4F6]",
    danger: "bg-[#FFF0EE] border border-[#FFD6C7] text-[#B42318] hover:bg-[#ffe4e0]",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div
        className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white flex flex-col`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12px] text-[#6B7280]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[#F3F4F6] px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-[#6B7280]">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-[#9CA3AF]">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    return (
      <textarea
        {...props}
        ref={ref}
        className={`${inputClass} resize-none ${props.className ?? ""}`}
      />
    );
  },
);

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-[#D1D5DB]">{icon}</div>}
      <p className="text-[13px] font-semibold text-[#374151]">{title}</p>
      {description && <p className="mt-1 text-[12px] text-[#9CA3AF]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const toneClass: Record<string, string> = {
    default: "bg-[#F3F4F6] text-[#374151]",
    warn: "bg-[#FFF4E5] text-[#B45309]",
    danger: "bg-[#FFF0EE] text-[#B42318]",
    good: "bg-[#F0FDF4] text-[#16A34A]",
  };
  return (
    <Card className="p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClass[tone]}`}>
        {icon}
      </div>
      <div className="mt-3 text-[12px] font-medium text-[#6B7280]">{label}</div>
      <div className="mt-1 text-[22px] font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-[#6B7280]">{sub}</div>}
    </Card>
  );
}

/** 0..1 비율 막대 */
export function MiniBar({ ratio, className = "" }: { ratio: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
