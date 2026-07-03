export type Role = "participant" | "admin";

export type CompanyId = "sanghyun" | "seoyoung" | "ain" | "donghyun" | "yeil";

export type JobRank = "사원" | "대리" | "과장" | "차장" | "부장";

export type GameStatus =
  | "BEFORE_START"
  | "SALARY_PAID"
  | "INVESTING"
  | "INVEST_CLOSED"
  | "SETTLED"
  | "YEAR_ENDED"
  | "REALTIME_ROUND"
  | "PAUSED"
  | "FINISHED";

export type PricePoint = {
  tick: number;
  year: number;
  value: number;
  createdAt: string;
};

export type Company = {
  id: CompanyId;
  name: string;
  initialCapital: number;
  currentValue: number;
  previousValue: number;
  changeRate: number;
  totalInvestment: number;
  rank: number;
  color: string;
  history: PricePoint[];
  memberAverageAsset: number;
  finalScore: number;
  createdAt: string;
  updatedAt: string;
};

export type Holding = {
  companyId: CompanyId;
  companyName: string;
  investedAmount: number;
  evaluatedAmount: number;
  returnRate: number;
  currentValue: number;
  changeRate: number;
};

export type User = {
  id: string;
  nickname: string;
  realName: string;
  companyId: CompanyId;
  companyName: string;
  rank: JobRank;
  cash: number;
  investedAmount: number;
  evaluatedAmount: number;
  totalAsset: number;
  returnRate: number;
  isOnline: boolean;
  role: Role;
  personalRank?: number;
  holdings: Holding[];
};

export type TransactionLog = {
  logId: string;
  userId: string;
  userName: string;
  companyId: CompanyId;
  companyName: string;
  amount: number;
  actionType: "INVEST" | "SALARY" | "SETTLEMENT" | "RESET";
  year: number;
  createdAt: string;
};

export type NewsItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  content: string;
  createdAt: string;
};

export type GameState = {
  sessionId: string;
  year: number;
  status: GameStatus;
  previousStatus?: GameStatus;
  timerEndsAt: string | null;
  remainingSeconds: number;
  pausedRemainingSeconds: number;
  personalRankingVisible: boolean;
  connectedCount: number;
  capacity: number;
  companies: Company[];
  users: User[];
  participants: User[];
  logs: TransactionLog[];
  news: NewsItem[];
  announcements: Announcement[];
  updatedAt: string;
};

export type LoginResponse = {
  user: User;
  state: GameState;
};

export type AdminLoginResponse = {
  user: User;
  state: GameState;
};
