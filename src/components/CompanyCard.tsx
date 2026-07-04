import { ChevronRight } from "lucide-react";
import type { Company } from "../types";
import { formatPercent, formatValue, formatWon } from "../utils/format";
import { CompanyChart } from "./CompanyChart";

type CompanyCardProps = {
  company: Company;
  investedAmount: number;
  evaluatedAmount: number;
  canInvest: boolean;
  onSelect?: (company: Company) => void;
};

export function CompanyCard({ company, investedAmount, evaluatedAmount, canInvest, onSelect }: CompanyCardProps) {
  const Wrapper = onSelect && canInvest ? "button" : "article";

  return (
    <Wrapper
      type={Wrapper === "button" ? "button" : undefined}
      onClick={Wrapper === "button" ? () => onSelect?.(company) : undefined}
      className="w-full rounded-card border border-slate-200 bg-white p-6 text-left shadow-soft transition duration-300 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400">기업 순위 {company.rank}위</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{company.name}</h2>
          <p className="mt-1 text-sm text-slate-500">내 투자금 {formatWon(investedAmount)}</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-lg font-bold text-slate-950">{formatValue(company.currentValue)}</p>
            <p
              className={`text-sm font-semibold ${
                company.changeRate >= 0 ? "text-red-500" : "text-blue-500"
              }`}
            >
              {formatPercent(company.changeRate)}
            </p>
          </div>
          {Wrapper === "button" ? <ChevronRight size={18} className="text-slate-300" aria-hidden /> : null}
        </div>
      </div>

      <div className="mt-4">
        <CompanyChart data={company.history} color={company.color} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">평가액</span>
          <p className="mt-1 text-sm font-bold text-slate-950">{formatWon(evaluatedAmount)}</p>
        </div>
        <div className="rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">총 투자</span>
          <p className="mt-1 text-sm font-bold text-slate-950">
            {formatWon(company.totalInvestment)}
          </p>
        </div>
        <div className="rounded-button bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">투자</span>
          <p className={`mt-1 text-sm font-bold ${canInvest ? "text-slate-950" : "text-slate-400"}`}>
            {canInvest ? "가능" : "마감"}
          </p>
        </div>
      </div>
    </Wrapper>
  );
}
