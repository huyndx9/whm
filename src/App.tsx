import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { buildForecast, getExpiryStatus, getStockStatus } from "./lib/forecast";
import Dashboard from "./pages/Dashboard";
import InOut from "./pages/InOut";
import Inventory from "./pages/Inventory";
import Forecast from "./pages/Forecast";
import Orders from "./pages/Orders";
import Suppliers from "./pages/Suppliers";
import ShiftClosePage from "./pages/ShiftClose";
import Sales from "./pages/Sales";
import SettingsPage from "./pages/Settings";

export type PageId =
  | "dashboard"
  | "sales"
  | "inventory"
  | "transactions"
  | "forecast"
  | "orders"
  | "suppliers"
  | "scan"
  | "shiftclose"
  | "settings";

const NAV: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "sales", label: "판매 등록", icon: ChefHat },
  { id: "inventory", label: "재고 관리", icon: Boxes },
  { id: "shiftclose", label: "일일 마감", icon: ClipboardCheck },
  { id: "transactions", label: "입출고 관리", icon: ClipboardList },
  { id: "forecast", label: "수요 예측", icon: BarChart3 },
  { id: "orders", label: "발주 관리", icon: ShoppingCart },
  { id: "suppliers", label: "공급업체", icon: Truck },
  { id: "settings", label: "설정", icon: SettingsIcon },
];

export default function App() {
  const { data } = useStore();
  const [page, setPage] = useState<PageId>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const rows = useMemo(
    () => buildForecast(data.ingredients, data.suppliers, data.transactions, data.settings),
    [data.ingredients, data.suppliers, data.transactions, data.settings],
  );

  const alertCount = useMemo(() => {
    let n = 0;
    for (const ing of data.ingredients) {
      if (!ing.active) continue;
      if (getStockStatus(ing) !== "OK") n++;
      const e = getExpiryStatus(ing, data.settings.expiryWarningDays);
      if (e !== "FRESH") n++;
    }
    return n;
  }, [data.ingredients, data.settings.expiryWarningDays]);

  const orderCount = useMemo(
    () => rows.filter((r) => r.needsOrder).length,
    [rows],
  );

  const badgeFor = (id: PageId): number => {
    if (id === "inventory") return alertCount;
    if (id === "orders") return orderCount;
    return 0;
  };

  const go = (id: PageId) => {
    setPage(id);
    setNavOpen(false);
  };

  const navList = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        const badge = badgeFor(item.id);
        return (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-[#0F4C5C] text-white shadow-[0_2px_8px_rgba(15,76,92,0.25)]"
                : "text-[#4B5563] hover:bg-[#F3F4F6]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {badge > 0 && (
              <span
                className={`min-w-[18px] whitespace-nowrap rounded-full px-1 text-[10px] font-bold leading-[18px] ${
                  active ? "bg-white/25 text-white" : "bg-[#FFF0EE] text-[#B42318]"
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="border-b border-[#F3F4F6] px-4 py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F4C5C] text-white">
          <Boxes className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold leading-tight">
            {data.settings.restaurantName}
          </div>
          <div className="text-[11px] text-[#6B7280]">재고 관리 시스템</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white lg:flex">
        {brand}
        {navList}
        <div className="border-t border-[#F3F4F6] px-4 py-3 text-[11px] text-[#9CA3AF]">
          모든 데이터는 이 기기에 저장됩니다
        </div>
      </aside>

      {/* 모바일 서랍 */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[264px] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pr-2">
              <div className="flex-1">{brand}</div>
              <button
                onClick={() => setNavOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navList}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E5E7EB] bg-[#F8F9FB]/90 px-4 py-3 backdrop-blur lg:px-6">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="메뉴 열기"
            className="rounded-xl border border-[#E5E7EB] bg-white p-2 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-[14px] font-bold">
            {NAV.find((n) => n.id === (page === "scan" ? "transactions" : page))?.label}
          </div>
          <div className="flex-1" />
          {alertCount > 0 && page !== "inventory" && (
            <button
              onClick={() => go("inventory")}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-1.5 text-[11px] font-semibold text-[#B42318]"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              확인 필요 {alertCount}건
            </button>
          )}
        </header>

        <div className="p-4 lg:p-6">
          {page === "dashboard" && <Dashboard rows={rows} onNavigate={go} />}
          {page === "inventory" && <Inventory rows={rows} />}
          {page === "sales" && <Sales onNavigate={go} />}

          {page === "shiftclose" && <ShiftClosePage />}
          {(page === "transactions" || page === "scan") && (
            // 대시보드에서 "영수증 스캔"으로 바로 들어오면 해당 탭을 열어 준다.
            // key 를 줘서 진입 경로가 바뀌면 탭 상태를 다시 잡게 한다.
            <InOut key={page} initialTab={page === "scan" ? "scan" : "history"} onNavigate={go} />
          )}
          {page === "forecast" && <Forecast rows={rows} />}
          {page === "orders" && <Orders rows={rows} />}
          {page === "suppliers" && <Suppliers />}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
