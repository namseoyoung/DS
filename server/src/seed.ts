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

const spongeNicknames = [
  "스폰지밥",
  "뚱이",
  "징징이",
  "다람이",
  "집게사장",
  "플랑크톤",
  "퐁퐁부인",
  "진주",
  "래리",
  "퍼프선생님",
  "캐런",
  "해적패치",
  "인어맨",
  "조개소년",
  "게리",
  "네모바지",
  "비키니시티",
  "해파리왕",
  "버블버디",
  "더치맨",
  "만타레이",
  "더티버블",
  "우체부피쉬",
  "경찰피쉬",
  "의사피쉬",
  "아나운서피쉬",
  "요리사피쉬",
  "손님피쉬",
  "선원피쉬",
  "시장피쉬",
];

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
    return {
      id: `p${String(number).padStart(3, "0")}`,
      password: "1111",
      nickname: spongeNicknames[index],
      realName: `테스트${number}`,
      companyId: companyCycle[index % companyCycle.length],
      rank: rankCycle[index % rankCycle.length],
      cash: 0,
      role: "participant" as const,
    };
  }),
];

export const isInvestableStatus = (status: GameStatus) =>
  status === "INVESTING" || status === "REALTIME_ROUND";

export const clampCompanyValue = (value: number) => Math.max(500, Math.round(value));

const clampRate = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const calculateRealtimeValue = (
  currentValue: number,
  totalInvestment: number,
  companyInvestment: number,
  totalInvestors: number,
  companyInvestors: number,
) => {
  if (totalInvestment <= 0 || totalInvestors <= 0) {
    return clampCompanyValue(currentValue);
  }

  const investmentShare = companyInvestment / totalInvestment;
  const investorShare = companyInvestors / totalInvestors;
  const share = investmentShare * 0.65 + investorShare * 0.35;
  const baseline = 1 / companySeeds.length;
  const demandPressure = (share - baseline) / baseline;
  const demandImpactRate = clampRate(demandPressure * 0.0035, -0.0035, 0.008);

  return clampCompanyValue(currentValue * (1 + demandImpactRate));
};
