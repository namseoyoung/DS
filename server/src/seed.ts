import type { CompanyId, GameStatus, JobRank, Role } from "../../src/types";

export const DEFAULT_SESSION_ID = "main-event";
export const CAPACITY = 40;
export const initialStatus: GameStatus = "BEFORE_START";

export const companySeeds: Array<{
  id: CompanyId;
  name: string;
  initialCapital: number;
  color: string;
}> = [
  { id: "sanghyun", name: "상현회사", initialCapital: 5000, color: "#e11d48" },
  { id: "seoyoung", name: "서영회사", initialCapital: 5000, color: "#2563eb" },
  { id: "ain", name: "아인회사", initialCapital: 5000, color: "#16a34a" },
  { id: "donghyun", name: "동현회사", initialCapital: 5000, color: "#f97316" },
  { id: "yeil", name: "예일회사", initialCapital: 4500, color: "#7c3aed" },
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
  yeil: {
    사원: 800,
    대리: 850,
    과장: 900,
    차장: 950,
    부장: 1000,
  },
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
    const realName = `테스트${number}`;
    return {
      id: `p${String(number).padStart(3, "0")}`,
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
