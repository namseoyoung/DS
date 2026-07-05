import { Activity, Building2, LogOut, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatPercent, formatSignedWon, formatWon } from "../utils/format";

type HeaderStatsProps = {
  realName: string;
  companyName: string;
  cash: number;
  investedAmount: number;
  evaluatedAmount: number;
  totalAsset: number;
  returnRate: number;
  year: number;
  connected: boolean;
  onLogout?: () => void;
};

export function HeaderStats({
  realName,
  companyName,
  cash,
  investedAmount,
  evaluatedAmount,
  totalAsset,
  returnRate,
  year,
  connected,
  onLogout,
}: HeaderStatsProps) {
  const isPositive = returnRate >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const profitAmount = evaluatedAmount - investedAmount;
  const isProfitPositive = profitAmount >= 0;

  return (
    <section className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 pb-4 pt-4 backdrop-blur">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1 text-sm font-medium text-slate-500">
              <Building2 size={14} aria-hidden />
              {companyName} · {year}년차
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{realName}</h1>
          </div>
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              aria-label="로그아웃"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-3 text-xs font-bold text-white transition active:scale-95"
            >
              <LogOut size={15} aria-hidden />
              로그아웃
            </button>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white">
              <Wallet size={20} aria-hidden />
            </div>
          )}
        </div>

        <div className="rounded-card bg-slate-950 p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">총자산</p>
            <span className="flex items-center gap-1 text-xs text-slate-300">
              <Activity size={13} aria-hidden />
              {connected ? "LIVE" : "연결 중"}
            </span>
          </div>
          <strong className="mt-1 block text-3xl font-bold tracking-normal">
            {formatWon(totalAsset)}
          </strong>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-400">현금</p>
              <p className="mt-1 text-sm font-semibold">{formatWon(cash)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">수익금</p>
              <p className={`mt-1 text-sm font-semibold ${isProfitPositive ? "text-red-400" : "text-blue-400"}`}>
                {formatSignedWon(profitAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">수익률</p>
              <p
                className={`mt-1 flex items-center gap-1 text-sm font-semibold ${
                  isPositive ? "text-red-400" : "text-blue-400"
                }`}
              >
                <TrendIcon size={15} aria-hidden />
                {formatPercent(returnRate)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
