import { ChevronRight, Info } from "lucide-react";
import type { Company } from "../types";
import { formatPercent, formatSignedWon, formatValue, formatWon } from "../utils/format";
import { CompanyChart } from "./CompanyChart";

type CompanyCardProps = {
  company: Company;
  investedAmount: number;
  evaluatedAmount: number;
  canInvest: boolean;
  onSelect?: (company: Company) => void;
  onOpenProfile?: (company: Company) => void;
};

export function CompanyCard({ company, investedAmount, evaluatedAmount, canInvest, onSelect, onOpenProfile }: CompanyCardProps) {
  const profitAmount = evaluatedAmount - investedAmount;
  const isProfitPositive = profitAmount >= 0;

  return (
    <article className="w-full rounded-card border border-slate-200 bg-white p-6 text-left shadow-soft transition duration-300">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenProfile?.(company)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-3">
            <CompanyAvatar company={company} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">기업 순위 {company.rank}위</p>
              <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{company.name}</h2>
              <p className="mt-1 line-clamp-1 text-sm text-slate-500">{company.tagline || "회사 소개를 확인해 보세요"}</p>
              <p className="mt-1 text-sm text-slate-500">내 투자금 {formatWon(investedAmount)}</p>
            </div>
          </div>
        </button>
        <div className="flex min-w-0 max-w-[42%] items-center gap-2 text-right">
          <div>
            <p className="money-text text-right text-base font-bold text-slate-950 sm:text-lg">{formatValue(company.currentValue)}</p>
            <p
              className={`text-sm font-semibold ${
                company.changeRate >= 0 ? "text-red-500" : "text-blue-500"
              }`}
            >
              {formatPercent(company.changeRate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenProfile?.(company)}
            aria-label={`${company.name} 소개 보기`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400"
          >
            <Info size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <CompanyChart data={company.history} color={company.color} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 min-w-0">
        <div className="min-w-0 rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">수익금</span>
          <p className={`money-text money-text-mini mt-1 font-bold ${isProfitPositive ? "text-red-500" : "text-blue-500"}`}>
            {formatSignedWon(profitAmount)}
          </p>
        </div>
        <div className="min-w-0 rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">총 투자</span>
          <p className="money-text money-text-mini mt-1 font-bold text-slate-950">
            {formatWon(company.totalInvestment)}
          </p>
        </div>
        <div className="min-w-0 rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">투자</span>
          <p className={`mt-1 text-sm font-bold ${canInvest ? "text-slate-950" : "text-slate-400"}`}>
            {canInvest ? "가능" : "마감"}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!canInvest}
        onClick={() => onSelect?.(company)}
        className="mt-4 flex h-[46px] w-full items-center justify-center gap-1 rounded-button bg-slate-950 text-sm font-bold text-white transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400"
      >
        {canInvest ? "투자하기" : "투자 마감"}
        {canInvest ? <ChevronRight size={16} aria-hidden /> : null}
      </button>
    </article>
  );
}

function CompanyAvatar({ company }: { company: Company }) {
  if (company.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-soft"
      style={{ backgroundColor: company.color }}
    >
      {company.name.slice(0, 1)}
    </div>
  );
}
