import { X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Company, CompanyId } from "../types";
import { formatValue, formatWon } from "../utils/format";

type InvestmentSheetProps = {
  company: Company | null;
  cash: number;
  onClose: () => void;
  onInvest: (companyId: CompanyId, amount: number) => Promise<void>;
};

const quickAmounts = [100, 500, 1000];

export function InvestmentSheet({ company, cash, onClose, onInvest }: InvestmentSheetProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = useMemo(() => Number(amount.replace(/[^0-9]/g, "")), [amount]);
  const canInvest = Boolean(company) && numericAmount > 0 && numericAmount <= cash && !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company || !canInvest) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onInvest(company.id, numericAmount);
      setAmount("");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "투자 처리에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/35 px-3 pb-3 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md rounded-card bg-white p-6 shadow-2xl animate-in"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">투자하기</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-950">{company.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              현재 기업 가치 {formatValue(company.currentValue)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="닫기"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-600">투자금</span>
          <div className="mt-3 flex h-[52px] items-center rounded-button border border-slate-200 bg-slate-50 px-4 transition focus-within:border-slate-950 focus-within:bg-white">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              placeholder="금액 입력"
              className="min-w-0 flex-1 bg-transparent text-xl font-bold text-slate-950 outline-none placeholder:text-slate-300"
            />
            <span className="ml-3 shrink-0 text-base font-bold text-slate-500">만원</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">예: 100 입력 시 100만원으로 투자됩니다.</p>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => setAmount(String(numericAmount + quickAmount))}
              className="h-[52px] rounded-button bg-slate-100 px-3 text-sm font-bold text-slate-700 transition active:scale-[0.98]"
            >
              +{quickAmount.toLocaleString("ko-KR")}만원
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount(String(cash))}
            className="h-[52px] rounded-button bg-slate-950 px-3 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            전액
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-slate-400">투자 가능 현금</span>
          <strong className="text-slate-950">{formatWon(cash)}</strong>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={!canInvest}
          className="mt-5 h-[52px] w-full rounded-button bg-slate-950 text-base font-bold text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSubmitting ? "처리 중" : "투자하기"}
        </button>
      </form>
    </div>
  );
}
