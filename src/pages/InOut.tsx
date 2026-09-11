import { useState } from "react";
import { Camera, ClipboardList } from "lucide-react";
import type { PageId } from "../App";
import Transactions from "./Transactions";
import ScanInvoice from "./ScanInvoice";

export type InOutTab = "history" | "scan";

const TABS: { id: InOutTab; label: string; icon: typeof Camera }[] = [
  { id: "history", label: "입출고 내역", icon: ClipboardList },
  { id: "scan", label: "영수증 스캔", icon: Camera },
];

export default function InOut({
  initialTab = "history",
  onNavigate,
}: {
  initialTab?: InOutTab;
  onNavigate: (id: PageId) => void;
}) {
  const [tab, setTab] = useState<InOutTab>(initialTab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E7EB] pb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? "border-transparent bg-[#0F4C5C] text-white"
                  : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "history" && <Transactions />}
      {tab === "scan" && <ScanInvoice onNavigate={onNavigate} />}
    </div>
  );
}
