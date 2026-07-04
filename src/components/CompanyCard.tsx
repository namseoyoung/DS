import { Building2, ChevronRight, X } from "lucide-react";
import { MouseEvent, useEffect, useState } from "react";
import type { Company, CompanyId } from "../types";
import { formatPercent, formatValue, formatWon } from "../utils/format";
import { CompanyChart } from "./CompanyChart";

type CompanyCardProps = {
  company: Company;
  investedAmount: number;
  evaluatedAmount: number;
  canInvest: boolean;
  onSelect?: (company: Company) => void;
};

type CompanyProfile = {
  initials: string;
  tagline: string;
  greeting: string;
};

const companyProfiles: Record<CompanyId, CompanyProfile> = {
  sanghyun: {
    initials: "SH",
    tagline: "안정적인 성장과 실행력을 앞세운 종합 투자 기업",
    greeting:
      "상현회사는 흔들리지 않는 운영력과 빠른 실행으로 시장 기회를 붙잡습니다. 참가자 여러분의 투자가 더 큰 성장의 속도로 이어지도록 만들겠습니다.",
  },
  seoyoung: {
    initials: "SY",
    tagline: "섬세한 전략과 균형 잡힌 포트폴리오의 회사",
    greeting:
      "서영회사는 데이터와 감각을 함께 보는 기업입니다. 안정적인 판단과 정확한 타이밍으로 투자자에게 신뢰받는 결과를 보여드리겠습니다.",
  },
  ain: {
    initials: "AI",
    tagline: "새로운 아이디어를 빠르게 실험하는 혁신 기업",
    greeting:
      "아인회사는 도전적인 기술과 창의적인 사업 모델을 바탕으로 성장합니다. 과감한 선택이 필요한 순간, 가장 흥미로운 가능성을 만들겠습니다.",
  },
  donghyun: {
    initials: "DH",
    tagline: "현장 감각과 추진력으로 움직이는 실전형 기업",
    greeting:
      "동현회사는 행동이 빠른 회사입니다. 시장의 변화를 놓치지 않고 투자자와 함께 매 순간 다음 기회를 향해 달리겠습니다.",
  },
  yeil: {
    initials: "YL",
    tagline: "작지만 단단하게 반등을 준비하는 가치 기업",
    greeting:
      "예일회사는 초기 조건은 다르지만 잠재력은 선명합니다. 선택과 집중으로 반전의 순간을 만들고, 끝까지 살아남는 기업이 되겠습니다.",
  },
};

export function CompanyCard({ company, investedAmount, evaluatedAmount, canInvest, onSelect }: CompanyCardProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profile = companyProfiles[company.id];

  return (
    <article className="w-full rounded-card border border-slate-200 bg-white p-6 text-left shadow-soft transition duration-300 active:scale-[0.99]">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <CompanyAvatar company={company} initials={profile.initials} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400">기업 순위 {company.rank}위</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{company.name}</h2>
            <p className="mt-1 truncate text-sm text-slate-500">내 투자금 {formatWon(investedAmount)}</p>
          </div>
        </button>

        <div className="text-right">
          <p className="text-lg font-bold text-slate-950">{formatValue(company.currentValue)}</p>
          <p className={`text-sm font-semibold ${company.changeRate >= 0 ? "text-red-500" : "text-blue-500"}`}>
            {formatPercent(company.changeRate)}
          </p>
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
          <p className="mt-1 text-sm font-bold text-slate-950">{formatWon(company.totalInvestment)}</p>
        </div>
        <button
          type="button"
          disabled={!canInvest}
          onClick={() => onSelect?.(company)}
          className={`flex items-center justify-between rounded-button px-3 py-2 text-left ${
            canInvest ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-400"
          }`}
        >
          <span>
            <span className="block text-xs font-medium opacity-70">투자</span>
            <span className="mt-1 block text-sm font-bold">{canInvest ? "하기" : "마감"}</span>
          </span>
          {canInvest ? <ChevronRight size={16} aria-hidden /> : null}
        </button>
      </div>

      {isProfileOpen ? (
        <CompanyProfileModal company={company} profile={profile} onClose={() => setIsProfileOpen(false)} />
      ) : null}
    </article>
  );
}

function CompanyAvatar({ company, initials }: { company: Company; initials: string }) {
  return (
    <div
      className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-black text-white shadow-soft"
      style={{
        background: `linear-gradient(135deg, ${company.color}, #020617)`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function CompanyProfileModal({
  company,
  profile,
  onClose,
}: {
  company: Company;
  profile: CompanyProfile;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 px-4 pb-4 pt-10 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-card bg-white p-6 shadow-soft"
        onClick={stopPropagation}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyAvatar company={company} initials={profile.initials} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">회사 소개</p>
              <h3 className="truncate text-xl font-bold text-slate-950">{company.name}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"
            aria-label="닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-5 rounded-button bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <Building2 size={16} aria-hidden />
            {profile.tagline}
          </div>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{profile.greeting}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Info label="현재 가치" value={formatValue(company.currentValue)} />
          <Info label="총 투자" value={formatWon(company.totalInvestment)} />
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}
