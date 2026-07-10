import type { CompanyId, GameStatus, JobRank, Role } from "../../src/types";

export const DEFAULT_SESSION_ID = "main-event";
export const CAPACITY = 40;
export const initialStatus: GameStatus = "BEFORE_START";

export const companySeeds: Array<{
  id: CompanyId;
  name: string;
  initialCapital: number;
  color: string;
  logoUrl: string;
  tagline: string;
}> = [
  { id: "sanghyun", name: "상현회사", initialCapital: 5000, color: "#e11d48", logoUrl: "/company-profiles/sanghyun.png", tagline: "빠른 실행력으로 시장을 선점하는 성장형 기업" },
  { id: "seoyoung", name: "서영회사", initialCapital: 5000, color: "#2563eb", logoUrl: "/company-profiles/seoyoung-v2.png", tagline: "안정적인 재무와 균형 잡힌 사업 포트폴리오" },
  { id: "ain", name: "아인회사", initialCapital: 5000, color: "#16a34a", logoUrl: "/company-profiles/ain.png", tagline: "기술과 브랜드 신뢰를 함께 키우는 혁신 기업" },
  { id: "donghyun", name: "동현회사", initialCapital: 5000, color: "#f97316", logoUrl: "/company-profiles/donghyun.png", tagline: "공격적인 투자로 판을 흔드는 도전형 기업" },
  { id: "yeil", name: "예일회사", initialCapital: 4500, color: "#7c3aed", logoUrl: "/company-profiles/yeil.png", tagline: "작지만 민첩하게 기회를 포착하는 실속형 기업" },
];

const defaultSalary = {
  사원: 900,
  대리: 950,
  과장: 1000,
  차장: 1050,
  부장: 1100,
} satisfies Record<JobRank, number>;

export const salaryTable: Record<CompanyId, Record<JobRank, number>> = {
  sanghyun: defaultSalary,
  seoyoung: defaultSalary,
  ain: defaultSalary,
  donghyun: defaultSalary,
  yeil: defaultSalary,
};

const participantNames: Record<string, string> = {
  p001: "강동훈",
  p002: "고은빈",
  p003: "구해원",
  p004: "권다빈",
  p005: "권태형",
  p006: "김가은",
  p007: "김민주",
  p008: "김여경",
  p009: "김재현",
  p010: "김진욱",
  p011: "류가영",
  p012: "박유서",
  p013: "서규민",
  p014: "이가영",
  p015: "이서은",
  p016: "이지훈",
  p017: "이해원",
  p018: "임다슬",
  p019: "임현우",
  p020: "전지우",
  p021: "정성희",
  p022: "최민희",
  p023: "최은주",
  p024: "최지은",
  p025: "최하은",
  p026: "한지영",
};

const companyCycle: CompanyId[] = ["sanghyun", "seoyoung", "ain", "donghyun", "yeil"];
const rankCycle: JobRank[] = ["사원", "대리", "과장", "차장", "부장"];

export const userSeeds: Array<{
  id: string;
  password: string;
  nickname: string;
  realName: string;
  companyId: CompanyId;
  rank: JobRank;
  cash: number;
  role: Role;
}> = [
  {
    id: "admin",
    password: "admin-2026",
    nickname: "운영자",
    realName: "관리자",
    companyId: "sanghyun",
    rank: "부장",
    cash: 0,
    role: "admin",
  },
  ...Array.from({ length: 30 }, (_, index) => {
    const number = index + 1;
    const id = `p${String(number).padStart(3, "0")}`;
    const realName = participantNames[id] ?? `테스트${number}`;
    return {
      id,
      password: "1111",
      nickname: realName,
      realName,
      companyId: companyCycle[index % companyCycle.length],
      rank: rankCycle[index % rankCycle.length],
      cash: 0,
      role: "participant" as const,
    };
  }),
];

export const isInvestableStatus = (status: GameStatus) =>
  status === "INVESTING" || status === "REALTIME_ROUND" || status === "ROUND_INVESTING";

export const clampCompanyValue = (value: number) => Math.max(500, Math.round(value));

export const calculateRealtimeValue = (
  currentValue: number,
  allCompanyScores: number[],
  companyScore: number,
  recentInvestmentShare: number,
) => {
  const totalScore = allCompanyScores.reduce((sum, score) => sum + Math.abs(score), 0);

  if (totalScore <= 0) {
    return clampCompanyValue(currentValue);
  }

  const rankRates = [0.15, 0.1, 0, -0.1, -0.15];
  const rank = allCompanyScores.filter((score) => score > companyScore).length;
  const baseRate = rankRates[Math.min(rank, rankRates.length - 1)] ?? -0.15;
  const overheatPenalty =
    recentInvestmentShare >= 0.3
      ? -Math.min(0.15, 0.1 + Math.max(0, recentInvestmentShare - 0.3) * 0.25)
      : 0;

  return clampCompanyValue(currentValue * (1 + baseRate + overheatPenalty));
};
