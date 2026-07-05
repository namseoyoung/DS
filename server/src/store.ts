import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Announcement,
  Company,
  CompanyId,
  GameState,
  GameStatus,
  Holding,
  NewsItem,
  TransactionLog,
  User,
  UserYearlyResult,
} from "../../src/types";
import {
  calculateRealtimeValue,
  CAPACITY,
  clampCompanyValue,
  companySeeds,
  DEFAULT_SESSION_ID,
  initialStatus,
  isInvestableStatus,
  salaryTable,
  userSeeds,
} from "./seed";

const now = () => new Date().toISOString();

type DbSession = {
  id: string;
  year: number;
  status: GameStatus;
  previous_status: GameStatus | null;
  timer_ends_at: string | null;
  paused_remaining_seconds: number | null;
  current_round?: number | null;
  max_rounds?: number | null;
  capacity: number;
  personal_ranking_revealed?: boolean | null;
  updated_at: string;
};

type DbCompany = {
  id: CompanyId;
  name: string;
  initial_capital: number;
  current_value: number;
  previous_value: number;
  change_rate?: number;
  total_investment?: number;
  company_rank?: number | null;
  color: string;
  logo_url?: string | null;
  tagline?: string | null;
  created_at: string;
  updated_at: string;
};

type DbUser = {
  id: string;
  username?: string;
  password: string;
  nickname: string;
  real_name: string;
  company_id: CompanyId;
  rank: User["rank"];
  cash: number;
  evaluated_amount?: number;
  total_asset?: number;
  profit_rate?: number;
  is_online: boolean;
  role: User["role"];
};

type DbInvestment = {
  id: string;
  user_id: string;
  company_id: CompanyId;
  amount?: number;
  invested_amount?: number;
  evaluated_amount?: number;
  profit_rate?: number;
  year: number;
  created_at: string;
  updated_at?: string;
};

type DbHistory = {
  company_id: CompanyId;
  tick: number;
  year: number;
  value: number;
  change_rate?: number;
  created_at: string;
  recorded_at?: string;
};

type DbLog = {
  id: string;
  user_id: string;
  user_name: string;
  company_id: CompanyId;
  company_name: string;
  amount: number;
  action_type: TransactionLog["actionType"];
  year: number;
  created_at: string;
};

type DbYearlyResult = {
  id: string;
  user_id: string;
  year: number;
  starting_cash: number;
  invested_amount: number;
  evaluated_amount: number;
  profit_amount: number;
  withdrawn_amount: number;
  ending_cash: number;
  total_asset: number;
  return_rate: number;
  created_at: string;
  updated_at: string;
};

export type Store = {
  initialize(): Promise<void>;
  getState(): Promise<GameState>;
  login(id: string, password: string): Promise<User>;
  setOnline(userId: string, isOnline: boolean): Promise<void>;
  invest(userId: string, companyId: CompanyId, amount: number): Promise<TransactionLog>;
  withdraw(userId: string, companyId: CompanyId): Promise<TransactionLog>;
  setStatus(status: GameStatus, durationSeconds?: number): Promise<void>;
  setPersonalRankingRevealed(revealed: boolean): Promise<void>;
  paySalary(): Promise<void>;
  settleYear(changes: Partial<Record<CompanyId, number>>): Promise<void>;
  advanceYear(): Promise<void>;
  retreatYear(): Promise<void>;
  advanceRound(): Promise<void>;
  settleRound(): Promise<void>;
  withdrawAllRoundInvestments(): Promise<void>;
  realtimeTick(): Promise<void>;
  publishNews(title: string, content: string): Promise<void>;
  publishAnnouncement(content: string): Promise<void>;
  updateUser(
    userId: string,
    patch: Partial<Pick<User, "realName" | "companyId" | "rank" | "cash">>,
  ): Promise<void>;
  updateCompany(
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue" | "logoUrl" | "tagline">>,
  ): Promise<void>;
  reset(scope?: string): Promise<void>;
};

const getRemainingSeconds = (timerEndsAt: string | null) => {
  if (!timerEndsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(timerEndsAt) - Date.now()) / 1000));
};

const MAX_ROUNDS = 10;

const isTimedPlayStatus = (status: GameStatus) =>
  status === "INVESTING" ||
  status === "REALTIME_ROUND" ||
  status === "ROUND_INVESTING" ||
  status === "ROUND_RESULT";

const getInvestmentAmount = (investment: DbInvestment) =>
  Number(investment.invested_amount ?? investment.amount ?? 0);

const calculateEvaluatedInvestment = (
  investment: DbInvestment,
  company: Pick<DbCompany, "initial_capital" | "current_value">,
) => {
  const investedAmount = getInvestmentAmount(investment);
  const evaluatedAmount = investedAmount * (company.current_value / company.initial_capital);
  const profitRate =
    investedAmount === 0 ? 0 : ((evaluatedAmount - investedAmount) / investedAmount) * 100;
  return { investedAmount, evaluatedAmount, profitRate };
};

const calculateVisibleInvestment = (
  investment: DbInvestment,
  company: Pick<DbCompany, "initial_capital" | "current_value">,
  useRealtimeValuation: boolean,
) => {
  if (useRealtimeValuation && investment.year === 4) {
    return calculateEvaluatedInvestment(investment, company);
  }

  const investedAmount = getInvestmentAmount(investment);
  const settledAmount = Number(investment.evaluated_amount ?? 0);
  const evaluatedAmount = settledAmount > 0 ? settledAmount : investedAmount;
  const profitRate =
    investedAmount === 0 ? 0 : ((evaluatedAmount - investedAmount) / investedAmount) * 100;

  return { investedAmount, evaluatedAmount, profitRate };
};

const getRealtimeOrderScore = (
  logs: DbLog[],
  companyId: CompanyId,
  year: number,
  since: string | null,
) => {
  const companyLogs = logs.filter((log) => {
    if (log.year !== year || log.company_id !== companyId) return false;
    if (log.action_type !== "INVEST" && log.action_type !== "WITHDRAW") return false;
    if (since && Date.parse(log.created_at) <= Date.parse(since)) return false;
    return true;
  });

  const buyLogs = companyLogs.filter((log) => log.action_type === "INVEST");
  const sellLogs = companyLogs.filter((log) => log.action_type === "WITHDRAW");
  const buyAmount = buyLogs.reduce((sum, log) => sum + log.amount, 0);
  const sellAmount = sellLogs.reduce((sum, log) => sum + log.amount, 0);
  const buyInvestors = new Set(buyLogs.map((log) => log.user_id)).size;
  const sellInvestors = new Set(sellLogs.map((log) => log.user_id)).size;

  return (Math.sqrt(buyAmount) - Math.sqrt(sellAmount)) * 0.7 + (buyInvestors - sellInvestors) * 30;
};

const getRecentInvestmentAmount = (
  logs: DbLog[],
  companyId: CompanyId,
  year: number,
  windowMs = 60_000,
) => {
  const cutoff = Date.now() - windowMs;
  return logs
    .filter(
      (log) =>
        log.year === year &&
        log.company_id === companyId &&
        log.action_type === "INVEST" &&
        Date.parse(log.created_at) >= cutoff,
    )
    .reduce((sum, log) => sum + log.amount, 0);
};

const calculateCompanyScore = (company: Company) => company.currentValue + company.memberAverageAsset * 0;

const calculateState = (
  session: DbSession,
  companiesRaw: DbCompany[],
  usersRaw: DbUser[],
  investments: DbInvestment[],
  history: DbHistory[],
  logs: DbLog[],
  yearlyResultsRaw: DbYearlyResult[],
  news: NewsItem[],
  announcements: Announcement[],
): GameState => {
  const useRealtimeValuation = session.year === 4;
  const yearlyResults: UserYearlyResult[] = yearlyResultsRaw
    .slice()
    .sort((a, b) => a.year - b.year || Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((item) => ({
      id: item.id,
      userId: item.user_id,
      year: item.year,
      startingCash: Number(item.starting_cash ?? 0),
      investedAmount: Number(item.invested_amount ?? 0),
      evaluatedAmount: Number(item.evaluated_amount ?? 0),
      profitAmount: Number(item.profit_amount ?? 0),
      withdrawnAmount: Number(item.withdrawn_amount ?? 0),
      endingCash: Number(item.ending_cash ?? 0),
      totalAsset: Number(item.total_asset ?? 0),
      returnRate: Number(item.return_rate ?? 0),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

  const companiesWithoutRank = companiesRaw.map<Company>((company) => {
    const totalInvestment = investments
      .filter((investment) => investment.company_id === company.id)
      .reduce((sum, investment) => sum + getInvestmentAmount(investment), 0);
    const currentYearInvestment = investments
      .filter((investment) => investment.company_id === company.id && investment.year === session.year)
      .reduce((sum, investment) => sum + getInvestmentAmount(investment), 0);
    const changeRate =
      company.previous_value === 0
        ? 0
        : ((company.current_value - company.previous_value) / company.previous_value) * 100;

    return {
      id: company.id,
      name: company.name,
      initialCapital: company.initial_capital,
      currentValue: company.current_value,
      previousValue: company.previous_value,
      changeRate,
      totalInvestment,
      currentYearInvestment,
      rank: 0,
      color: company.color,
      logoUrl: company.logo_url ?? "",
      tagline: company.tagline ?? "",
      history: history
        .filter((point) => point.company_id === company.id)
        .map((point) => ({
          tick: point.tick,
          year: point.year,
          value: point.value,
          createdAt: point.created_at,
        })),
      memberAverageAsset: 0,
      finalScore: 0,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };
  });

  const usersWithoutRank = usersRaw.map<User>((user) => {
    const companyName =
      companiesWithoutRank.find((company) => company.id === user.company_id)?.name ?? user.company_id;
    const holdings: Holding[] = companiesWithoutRank.map((company) => {
      const userInvestments = investments.filter(
        (investment) => investment.user_id === user.id && investment.company_id === company.id,
      );
      const valuation = userInvestments.reduce(
        (sum, investment) => {
          const item = calculateVisibleInvestment(
            investment,
            {
              initial_capital: company.initialCapital,
              current_value: company.currentValue,
            },
            useRealtimeValuation,
          );
          return {
            investedAmount: sum.investedAmount + item.investedAmount,
            evaluatedAmount: sum.evaluatedAmount + item.evaluatedAmount,
          };
        },
        { investedAmount: 0, evaluatedAmount: 0 },
      );
      const { investedAmount, evaluatedAmount } = valuation;
      return {
        companyId: company.id,
        companyName: company.name,
        investedAmount,
        evaluatedAmount,
        returnRate:
          investedAmount === 0 ? 0 : ((evaluatedAmount - investedAmount) / investedAmount) * 100,
        currentValue: company.currentValue,
        changeRate: company.changeRate,
      };
    });
    const investedAmount = holdings.reduce((sum, holding) => sum + holding.investedAmount, 0);
    const evaluatedAmount = holdings.reduce((sum, holding) => sum + holding.evaluatedAmount, 0);
    const totalAsset = user.cash + evaluatedAmount;

    return {
      id: user.id,
      realName: user.real_name,
      companyId: user.company_id,
      companyName,
      rank: user.rank,
      cash: user.cash,
      investedAmount,
      evaluatedAmount,
      totalAsset,
      returnRate:
        investedAmount === 0 ? 0 : ((evaluatedAmount - investedAmount) / investedAmount) * 100,
      isOnline: user.is_online,
      role: user.role,
      holdings,
    };
  });

  const participants = usersWithoutRank
    .filter((user) => user.role === "participant")
    .sort((a, b) => b.totalAsset - a.totalAsset)
    .map((user, index) => ({ ...user, personalRank: index + 1 }));

  const users = usersWithoutRank.map((user) => {
    const ranked = participants.find((participant) => participant.id === user.id);
    return ranked ?? user;
  });

  const companies = companiesWithoutRank
    .map((company) => {
      const members = participants.filter((participant) => participant.companyId === company.id);
      const memberAverageAsset =
        members.length === 0
          ? 0
          : members.reduce((sum, member) => sum + member.totalAsset, 0) / members.length;
      const withAverage = { ...company, memberAverageAsset };
      return { ...withAverage, finalScore: calculateCompanyScore(withAverage) };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((company, index) => ({ ...company, rank: index + 1 }));

  return {
    sessionId: session.id,
    year: session.year,
    status: session.status,
    previousStatus: session.previous_status ?? undefined,
    timerEndsAt: session.timer_ends_at,
    remainingSeconds: getRemainingSeconds(session.timer_ends_at),
    pausedRemainingSeconds: session.paused_remaining_seconds ?? 0,
    currentRound: session.current_round ?? 1,
    maxRounds: session.max_rounds ?? MAX_ROUNDS,
    connectedCount: users.filter((user) => user.isOnline).length,
    capacity: session.capacity,
    personalRankingRevealed: Boolean(session.personal_ranking_revealed),
    companies,
    users,
    participants,
    yearlyResults,
    logs: logs
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 80)
      .map((log) => ({
        logId: log.id,
        userId: log.user_id,
        userName: log.user_name,
        companyId: log.company_id,
        companyName: log.company_name,
        amount: log.amount,
        actionType: log.action_type,
        year: log.year,
        createdAt: log.created_at,
      })),
    news: news.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    announcements: announcements
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    updatedAt: session.updated_at,
  };
};

class MemoryStore implements Store {
  private session: DbSession = {
    id: DEFAULT_SESSION_ID,
    year: 1,
    status: initialStatus,
    previous_status: null,
    timer_ends_at: null,
    paused_remaining_seconds: null,
    current_round: 1,
    max_rounds: MAX_ROUNDS,
    capacity: CAPACITY,
    updated_at: now(),
  };

  private companies: DbCompany[] = [];
  private users: DbUser[] = [];
  private investments: DbInvestment[] = [];
  private history: DbHistory[] = [];
  private logs: DbLog[] = [];
  private yearlyResults: DbYearlyResult[] = [];
  private news: NewsItem[] = [];
  private announcements: Announcement[] = [];

  async initialize() {
    const createdAt = now();
    if (this.companies.length === 0) {
      this.companies = companySeeds.map((company) => ({
        id: company.id,
        name: company.name,
        initial_capital: company.initialCapital,
        current_value: company.initialCapital,
        previous_value: company.initialCapital,
        color: company.color,
        logo_url: company.logoUrl,
        tagline: company.tagline,
        created_at: createdAt,
        updated_at: createdAt,
      }));
      this.history = this.companies.map((company) => ({
        company_id: company.id,
        tick: 0,
        year: 1,
        value: company.current_value,
        created_at: createdAt,
      }));
    }
    if (this.users.length === 0) {
      this.users = userSeeds.map((user) => ({
        id: user.id,
        password: user.password,
        nickname: user.realName,
        real_name: user.realName,
        company_id: user.companyId,
        rank: user.rank,
        cash: user.cash,
        is_online: false,
        role: user.role,
      }));
    }
  }

  async getState() {
    return calculateState(
      this.session,
      this.companies,
      this.users,
      this.investments,
      this.history,
      this.logs,
      this.yearlyResults,
      this.news,
      this.announcements,
    );
  }

  async login(id: string, password: string) {
    const user = this.users.find((item) => item.id === id && item.password === password);
    if (!user) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    user.is_online = true;
    this.session.updated_at = now();
    const state = await this.getState();
    return state.users.find((item) => item.id === user.id)!;
  }

  async setOnline(userId: string, isOnline: boolean) {
    const user = this.users.find((item) => item.id === userId);
    if (user) {
      user.is_online = isOnline;
      this.session.updated_at = now();
    }
  }

  async invest(userId: string, companyId: CompanyId, amount: number) {
    if (!isInvestableStatus(this.session.status)) {
      throw new Error("현재는 투자 가능 상태가 아닙니다.");
    }

    const user = this.users.find((item) => item.id === userId);
    const company = this.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("투자할 회원 또는 기업을 찾을 수 없습니다.");
    }
    if (amount <= 0 || amount > user.cash) {
      throw new Error("보유 현금보다 많이 투자할 수 없습니다.");
    }

    user.cash -= amount;
    company.total_investment = Number(company.total_investment ?? 0) + amount;
    const existingInvestment = this.investments.find(
      (investment) =>
        investment.user_id === user.id &&
        investment.company_id === company.id &&
        investment.year === this.session.year,
    );
    if (existingInvestment) {
      existingInvestment.invested_amount = getInvestmentAmount(existingInvestment) + amount;
      existingInvestment.updated_at = now();
    } else {
      this.investments.push({
        id: crypto.randomUUID(),
        user_id: user.id,
        company_id: company.id,
        invested_amount: amount,
        evaluated_amount: 0,
        profit_rate: 0,
        year: this.session.year,
        created_at: now(),
        updated_at: now(),
      });
    }

    const log = this.addLog(user.id, user.real_name, company.id, company.name, amount, "INVEST");
    this.session.updated_at = now();
    return {
      logId: log.id,
      userId: log.user_id,
      userName: log.user_name,
      companyId: log.company_id,
      companyName: log.company_name,
      amount: log.amount,
      actionType: log.action_type,
      year: log.year,
      createdAt: log.created_at,
    };
  }

  async withdraw(userId: string, companyId: CompanyId) {
    if (this.session.status === "FINISHED") {
      throw new Error("게임 종료 후에는 투자금을 회수할 수 없습니다.");
    }

    const user = this.users.find((item) => item.id === userId);
    const company = this.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("회수할 회원 또는 기업을 찾을 수 없습니다.");
    }

    const userInvestments = this.investments.filter(
      (investment) =>
        investment.user_id === user.id &&
        investment.company_id === company.id &&
        getInvestmentAmount(investment) > 0,
    );
    if (userInvestments.length === 0) {
      throw new Error("회수할 투자금이 없습니다.");
    }

    const valuation = userInvestments.reduce(
      (sum, investment) => {
        const item = calculateVisibleInvestment(
          investment,
          {
            initial_capital: company.initial_capital,
            current_value: company.current_value,
          },
          this.session.year === 4,
        );
        return {
          investedAmount: sum.investedAmount + item.investedAmount,
          evaluatedAmount: sum.evaluatedAmount + item.evaluatedAmount,
        };
      },
      { investedAmount: 0, evaluatedAmount: 0 },
    );
    const payout = Math.max(0, Math.floor(valuation.evaluatedAmount));

    user.cash += payout;
    this.addMemoryWithdrawalResult(user.id, this.session.year, payout, user.cash);
    company.total_investment = Math.max(
      0,
      Number(company.total_investment ?? 0) - valuation.investedAmount,
    );
    const withdrawnIds = new Set(userInvestments.map((investment) => investment.id));
    this.investments = this.investments.filter((investment) => !withdrawnIds.has(investment.id));

    const log = this.addLog(user.id, user.real_name, company.id, company.name, payout, "WITHDRAW");
    this.session.updated_at = now();
    return {
      logId: log.id,
      userId: log.user_id,
      userName: log.user_name,
      companyId: log.company_id,
      companyName: log.company_name,
      amount: log.amount,
      actionType: log.action_type,
      year: log.year,
      createdAt: log.created_at,
    };
  }

  async setStatus(status: GameStatus, durationSeconds?: number) {
    const remainingSeconds = getRemainingSeconds(this.session.timer_ends_at);
    const previousStatus = this.session.status;
    this.session.previous_status = this.session.status;
    this.session.status = status;
    if (status === "REALTIME_ROUND" || status === "ROUND_INVESTING") {
      this.session.year = 4;
      if (status === "ROUND_INVESTING" && previousStatus !== "ROUND_RESULT") {
        this.session.current_round = 1;
        this.session.max_rounds = MAX_ROUNDS;
      }
      const createdAt = now();
      for (const company of this.companies) {
        const hasYearOpeningPoint = this.history.some(
          (point) => point.company_id === company.id && point.year === 4 && point.tick === 0,
        );
        if (!hasYearOpeningPoint) {
          this.history.push({
            company_id: company.id,
            tick: 0,
            year: 4,
            value: company.current_value,
            change_rate: 0,
            created_at: createdAt,
            recorded_at: createdAt,
          });
        }
      }
    }
    if (status === "PAUSED") {
      this.session.paused_remaining_seconds = remainingSeconds;
      this.session.timer_ends_at = null;
    } else if (durationSeconds && isTimedPlayStatus(status)) {
      this.session.timer_ends_at = new Date(Date.now() + durationSeconds * 1000).toISOString();
      this.session.paused_remaining_seconds = null;
    } else if (
      isTimedPlayStatus(status) &&
      this.session.paused_remaining_seconds
    ) {
      this.session.timer_ends_at = new Date(
        Date.now() + this.session.paused_remaining_seconds * 1000,
      ).toISOString();
      this.session.paused_remaining_seconds = null;
    } else if (status === "INVEST_CLOSED" || status === "FINISHED" || status === "SETTLED") {
      this.session.timer_ends_at = null;
      this.session.paused_remaining_seconds = null;
    }
    this.session.updated_at = now();
  }

  async setPersonalRankingRevealed(revealed: boolean) {
    this.session.personal_ranking_revealed = revealed;
    this.session.updated_at = now();
  }

  async paySalary() {
    for (const user of this.users.filter((item) => item.role === "participant")) {
      const salary = salaryTable[user.company_id][user.rank];
      user.cash += salary;
      const company = this.companies.find((item) => item.id === user.company_id)!;
      this.addLog(user.id, user.real_name, company.id, company.name, salary, "SALARY");
    }
    await this.setStatus("SALARY_PAID");
  }

  private upsertMemoryYearlyResult(result: Omit<DbYearlyResult, "id" | "created_at" | "updated_at">) {
    const existing = this.yearlyResults.find(
      (item) => item.user_id === result.user_id && item.year === result.year,
    );
    const timestamp = now();
    if (existing) {
      Object.assign(existing, result, { updated_at: timestamp });
      return;
    }
    this.yearlyResults.push({
      ...result,
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  private addMemoryWithdrawalResult(userId: string, year: number, payout: number, endingCash: number) {
    const existing = this.yearlyResults.find((item) => item.user_id === userId && item.year === year);
    if (!existing) return;
    existing.withdrawn_amount = Number(existing.withdrawn_amount ?? 0) + payout;
    existing.ending_cash = endingCash;
    existing.updated_at = now();
  }

  async settleYear(changes: Partial<Record<CompanyId, number>>) {
    for (const company of this.companies) {
      const change = changes[company.id] ?? 0;
      const nextValue = clampCompanyValue(company.current_value * (1 + change / 100));
      company.previous_value = company.current_value;
      company.current_value = nextValue;
      company.updated_at = now();
      this.history.push({
        company_id: company.id,
        tick: this.history.filter((point) => point.company_id === company.id).length,
        year: this.session.year,
        value: nextValue,
        change_rate: change,
        created_at: now(),
        recorded_at: now(),
      });
    }
    for (const investment of this.investments.filter((item) => item.year === this.session.year)) {
      const company = this.companies.find((item) => item.id === investment.company_id);
      if (!company) continue;
      const evaluated = calculateEvaluatedInvestment(investment, company);
      investment.evaluated_amount = evaluated.evaluatedAmount;
      investment.profit_rate = evaluated.profitRate;
      investment.updated_at = now();
    }
    for (const user of this.users.filter((item) => item.role === "participant")) {
      const userInvestments = this.investments.filter(
        (investment) => investment.user_id === user.id && investment.year === this.session.year,
      );
      const investedAmount = userInvestments.reduce((sum, item) => sum + getInvestmentAmount(item), 0);
      const evaluatedAmount = userInvestments.reduce((sum, item) => sum + Number(item.evaluated_amount ?? 0), 0);
      const profitAmount = evaluatedAmount - investedAmount;
      this.upsertMemoryYearlyResult({
        user_id: user.id,
        year: this.session.year,
        starting_cash: user.cash,
        invested_amount: investedAmount,
        evaluated_amount: evaluatedAmount,
        profit_amount: profitAmount,
        withdrawn_amount: 0,
        ending_cash: user.cash,
        total_asset: user.cash + evaluatedAmount,
        return_rate: investedAmount === 0 ? 0 : (profitAmount / investedAmount) * 100,
      });
    }
    this.addLog("admin", "운영자", "sanghyun", "정산", 0, "SETTLEMENT");
    await this.setStatus("SETTLED");
  }

  async advanceYear() {
    this.session.year = Math.min(4, this.session.year + 1);
    await this.setStatus(this.session.year === 4 ? "ROUND_INVESTING" : "YEAR_ENDED");
    if (this.session.year === 4) {
      this.session.timer_ends_at = null;
      this.session.paused_remaining_seconds = null;
    }
  }

  async retreatYear() {
    if (this.session.year <= 1) {
      throw new Error("이미 1년차입니다.");
    }
    this.session.year = Math.max(1, this.session.year - 1);
    await this.setStatus("YEAR_ENDED");
  }

  async advanceRound() {
    const currentRound = this.session.current_round ?? 1;
    const maxRounds = this.session.max_rounds ?? MAX_ROUNDS;
    if (currentRound >= maxRounds) {
      await this.setStatus("FINISHED");
      return;
    }
    this.session.current_round = currentRound + 1;
    await this.setStatus("ROUND_INVESTING");
    this.session.timer_ends_at = null;
    this.session.paused_remaining_seconds = null;
  }

  async settleRound() {
    await this.realtimeTick();
    await this.setStatus("ROUND_RESULT");
    this.session.timer_ends_at = null;
    this.session.paused_remaining_seconds = null;
  }

  async withdrawAllRoundInvestments() {
    const roundInvestments = this.investments.filter(
      (investment) => investment.year === this.session.year && getInvestmentAmount(investment) > 0,
    );
    const yearlySnapshots = new Map<
      string,
      { startingCash: number; investedAmount: number; evaluatedAmount: number; payout: number }
    >();

    for (const investment of roundInvestments) {
      const user = this.users.find((item) => item.id === investment.user_id);
      const company = this.companies.find((item) => item.id === investment.company_id);
      if (!user || !company) continue;
      const valuation = calculateEvaluatedInvestment(investment, company);
      const payout = Math.max(0, Math.floor(valuation.evaluatedAmount));
      const snapshot = yearlySnapshots.get(user.id) ?? {
        startingCash: user.cash,
        investedAmount: 0,
        evaluatedAmount: 0,
        payout: 0,
      };
      snapshot.investedAmount += valuation.investedAmount;
      snapshot.evaluatedAmount += valuation.evaluatedAmount;
      snapshot.payout += payout;
      yearlySnapshots.set(user.id, snapshot);

      user.cash += payout;
      company.total_investment = Math.max(
        0,
        Number(company.total_investment ?? 0) - valuation.investedAmount,
      );
      this.addLog(user.id, user.real_name, company.id, company.name, payout, "WITHDRAW");
    }

    for (const [userId, snapshot] of yearlySnapshots.entries()) {
      const user = this.users.find((item) => item.id === userId);
      if (!user) continue;
      const existing = this.yearlyResults.find(
        (item) => item.user_id === userId && item.year === this.session.year,
      );
      if (existing) {
        this.addMemoryWithdrawalResult(userId, this.session.year, snapshot.payout, user.cash);
        continue;
      }
      const profitAmount = snapshot.evaluatedAmount - snapshot.investedAmount;
      this.upsertMemoryYearlyResult({
        user_id: userId,
        year: this.session.year,
        starting_cash: snapshot.startingCash,
        invested_amount: snapshot.investedAmount,
        evaluated_amount: snapshot.evaluatedAmount,
        profit_amount: profitAmount,
        withdrawn_amount: snapshot.payout,
        ending_cash: user.cash,
        total_asset: user.cash,
        return_rate: snapshot.investedAmount === 0 ? 0 : (profitAmount / snapshot.investedAmount) * 100,
      });
    }

    const withdrawnIds = new Set(roundInvestments.map((investment) => investment.id));
    this.investments = this.investments.filter((investment) => !withdrawnIds.has(investment.id));
    this.session.updated_at = now();
  }

  async realtimeTick() {
    const orderScores = this.companies.map((company) => {
      const companyHistory = this.history.filter(
        (point) => point.company_id === company.id && point.year === this.session.year,
      );
      const lastPoint = companyHistory[companyHistory.length - 1];
      return getRealtimeOrderScore(
        this.logs,
        company.id,
        this.session.year,
        lastPoint?.recorded_at ?? lastPoint?.created_at ?? null,
      );
    });
    const recentInvestmentAmounts = this.companies.map((company) =>
      getRecentInvestmentAmount(this.logs, company.id, this.session.year),
    );
    const totalRecentInvestment = recentInvestmentAmounts.reduce((sum, amount) => sum + amount, 0);

    for (const [index, company] of this.companies.entries()) {
      const tick = this.history.filter((point) => point.company_id === company.id).length;
      const nextValue = calculateRealtimeValue(
        company.current_value,
        orderScores,
        orderScores[index] ?? 0,
        totalRecentInvestment > 0 ? (recentInvestmentAmounts[index] ?? 0) / totalRecentInvestment : 0,
      );
      company.previous_value = company.current_value;
      company.current_value = nextValue;
      company.updated_at = now();
      this.history.push({
        company_id: company.id,
        tick,
        year: this.session.year,
        value: nextValue,
        change_rate:
          company.previous_value === 0
            ? 0
            : ((nextValue - company.previous_value) / company.previous_value) * 100,
        created_at: now(),
        recorded_at: now(),
      });
    }
    this.session.updated_at = now();
  }

  async publishNews(title: string, content: string) {
    this.news.unshift({ id: crypto.randomUUID(), title, content, createdAt: now() });
    this.session.updated_at = now();
  }

  async publishAnnouncement(content: string) {
    this.announcements.unshift({ id: crypto.randomUUID(), content, createdAt: now() });
    this.session.updated_at = now();
  }

  async updateUser(
    userId: string,
    patch: Partial<Pick<User, "realName" | "companyId" | "rank" | "cash">>,
  ) {
    const user = this.users.find((item) => item.id === userId);
    if (!user || user.role !== "participant") throw new Error("수정할 회원을 찾을 수 없습니다.");
    if (patch.realName !== undefined) user.real_name = patch.realName;
    if (patch.companyId !== undefined) user.company_id = patch.companyId;
    if (patch.rank !== undefined) user.rank = patch.rank;
    if (patch.cash !== undefined) user.cash = Math.max(0, Math.floor(Number(patch.cash)));
    this.session.updated_at = now();
  }

  async updateCompany(
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue" | "logoUrl" | "tagline">>,
  ) {
    const company = this.companies.find((item) => item.id === companyId);
    if (!company) throw new Error("수정할 기업을 찾을 수 없습니다.");
    if (patch.name !== undefined) company.name = patch.name;
    if (patch.logoUrl !== undefined) company.logo_url = patch.logoUrl;
    if (patch.tagline !== undefined) company.tagline = patch.tagline;
    if (patch.initialCapital !== undefined) {
      company.initial_capital = Math.max(1, Math.floor(Number(patch.initialCapital)));
    }
    if (patch.currentValue !== undefined) {
      company.previous_value = company.current_value;
      company.current_value = clampCompanyValue(Number(patch.currentValue));
      this.history.push({
        company_id: company.id,
        tick: this.history.filter((point) => point.company_id === company.id).length,
        year: this.session.year,
        value: company.current_value,
        created_at: now(),
      });
    }
    company.updated_at = now();
    this.session.updated_at = now();
  }

  async reset(scope = "all") {
    if (scope === "logs") {
      this.logs = [];
      return;
    }
    if (scope === "assets") {
      this.users = this.users.map((user) => ({
        ...user,
        cash: userSeeds.find((seed) => seed.id === user.id)?.cash ?? user.cash,
      }));
      this.investments = [];
      return;
    }
    if (scope === "companies") {
      this.companies = [];
      this.history = [];
      await this.initialize();
      return;
    }

    this.session = {
      id: DEFAULT_SESSION_ID,
      year: 1,
      status: initialStatus,
      previous_status: null,
      timer_ends_at: null,
      paused_remaining_seconds: null,
      current_round: 1,
      max_rounds: MAX_ROUNDS,
      capacity: CAPACITY,
      updated_at: now(),
    };
    this.companies = [];
    this.users = [];
    this.investments = [];
    this.history = [];
    this.logs = [];
    this.news = [];
    this.announcements = [];
    await this.initialize();
  }

  private addLog(
    userId: string,
    userName: string,
    companyId: CompanyId,
    companyName: string,
    amount: number,
    actionType: TransactionLog["actionType"],
  ) {
    const log: DbLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: userName,
      company_id: companyId,
      company_name: companyName,
      amount,
      action_type: actionType,
      year: this.session.year,
      created_at: now(),
    };
    this.logs.unshift(log);
    return log;
  }
}

class SupabaseStore extends MemoryStore {
  constructor(private readonly supabase: SupabaseClient) {
    super();
  }

  async initialize() {
    await this.supabase.from("game_status").upsert({
      id: DEFAULT_SESSION_ID,
      year: 1,
      status: initialStatus,
      previous_status: null,
      timer_ends_at: null,
      paused_remaining_seconds: null,
      current_round: 1,
      max_rounds: MAX_ROUNDS,
      capacity: CAPACITY,
      personal_ranking_revealed: false,
    });

    const { data: companies } = await this.supabase.from("companies").select("id");
    if (!companies || companies.length === 0) {
      await this.supabase.from("companies").insert(
        companySeeds.map((company) => ({
          id: company.id,
          name: company.name,
          initial_capital: company.initialCapital,
          current_value: company.initialCapital,
          previous_value: company.initialCapital,
          color: company.color,
          logo_url: company.logoUrl,
          tagline: company.tagline,
        })),
      );
      await this.supabase.from("company_value_history").insert(
        companySeeds.map((company) => ({
          company_id: company.id,
          tick: 0,
          year: 1,
          value: company.initialCapital,
        })),
      );
    }

    const { data: users } = await this.supabase.from("users").select("id");
    if (!users || users.length === 0) {
      await this.supabase.from("users").insert(
        userSeeds.map((user) => ({
          id: user.id,
          password: user.password,
          nickname: user.realName,
          real_name: user.realName,
          company_id: user.companyId,
          rank: user.rank,
          cash: user.cash,
          is_online: false,
          role: user.role,
        })),
      );
    }
  }

  async getState() {
    const [
      { data: session },
      { data: companies },
      { data: users },
      { data: investments },
      { data: history },
      { data: logs },
      { data: yearlyResults },
      { data: news },
      { data: announcements },
    ] = await Promise.all([
      this.supabase.from("game_status").select("*").eq("id", DEFAULT_SESSION_ID).single(),
      this.supabase.from("companies").select("*").order("id"),
      this.supabase.from("users").select("*").order("id"),
      this.supabase.from("investments").select("*").order("created_at", { ascending: false }),
      this.supabase.from("company_value_history").select("*").order("tick"),
      this.supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      this.supabase.from("user_yearly_results").select("*").order("year"),
      this.supabase.from("news").select("*").order("created_at", { ascending: false }).limit(20),
      this.supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!session || !companies || !users || !investments || !history || !logs) {
      throw new Error("Supabase 상태를 불러오지 못했습니다.");
    }

    return calculateState(
      session as DbSession,
      companies as DbCompany[],
      users as DbUser[],
      investments as DbInvestment[],
      history as DbHistory[],
      logs as DbLog[],
      (yearlyResults ?? []) as DbYearlyResult[],
      ((news ?? []) as Array<{ id: string; title: string; content: string; created_at: string }>).map(
        (item) => ({ id: item.id, title: item.title, content: item.content, createdAt: item.created_at }),
      ),
      ((announcements ?? []) as Array<{ id: string; content: string; created_at: string }>).map(
        (item) => ({ id: item.id, content: item.content, createdAt: item.created_at }),
      ),
    );
  }

  async login(id: string, password: string) {
    const { data: user } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .eq("password", password)
      .single();
    if (!user) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    await this.supabase.from("users").update({ is_online: true }).eq("id", id);
    return (await this.getState()).users.find((item) => item.id === id)!;
  }

  async setOnline(userId: string, isOnline: boolean) {
    await this.supabase.from("users").update({ is_online: isOnline }).eq("id", userId);
  }

  async invest(userId: string, companyId: CompanyId, amount: number) {
    const state = await this.getState();
    if (!isInvestableStatus(state.status)) throw new Error("현재는 투자 가능 상태가 아닙니다.");
    const user = state.users.find((item) => item.id === userId);
    const company = state.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("투자할 회원 또는 기업을 찾을 수 없습니다.");
    }
    if (amount <= 0 || amount > user.cash) {
      throw new Error("보유 현금보다 많이 투자할 수 없습니다.");
    }

    await this.supabase.from("users").update({ cash: user.cash - amount }).eq("id", userId);
    await this.supabase
      .from("companies")
      .update({ total_investment: company.totalInvestment + amount, updated_at: now() })
      .eq("id", companyId);
    const { data: existingInvestment } = await this.supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("year", state.year)
      .maybeSingle();

    if (existingInvestment) {
      await this.supabase
        .from("investments")
        .update({
          invested_amount: getInvestmentAmount(existingInvestment as DbInvestment) + amount,
          updated_at: now(),
        })
        .eq("id", existingInvestment.id);
    } else {
      await this.supabase.from("investments").insert({
        user_id: userId,
        company_id: companyId,
        invested_amount: amount,
        evaluated_amount: 0,
        profit_rate: 0,
        year: state.year,
      });
    }
    const { data: log } = await this.supabase
      .from("transactions")
      .insert({
        user_id: userId,
        user_name: user.realName,
        company_id: companyId,
        company_name: company.name,
        amount,
        action_type: "INVEST",
        year: state.year,
      })
      .select("*")
      .single();

    return {
      logId: log.id,
      userId: log.user_id,
      userName: log.user_name,
      companyId: log.company_id,
      companyName: log.company_name,
      amount: log.amount,
      actionType: log.action_type,
      year: log.year,
      createdAt: log.created_at,
    };
  }

  async withdraw(userId: string, companyId: CompanyId) {
    const state = await this.getState();
    if (state.status === "FINISHED") {
      throw new Error("게임 종료 후에는 투자금을 회수할 수 없습니다.");
    }

    const user = state.users.find((item) => item.id === userId);
    const company = state.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("회수할 회원 또는 기업을 찾을 수 없습니다.");
    }

    const { data: investments } = await this.supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId);
    const userInvestments = ((investments ?? []) as DbInvestment[]).filter(
      (investment) => getInvestmentAmount(investment) > 0,
    );
    if (userInvestments.length === 0) {
      throw new Error("회수할 투자금이 없습니다.");
    }

    const valuation = userInvestments.reduce(
      (sum, investment) => {
        const item = calculateVisibleInvestment(
          investment,
          {
            initial_capital: company.initialCapital,
            current_value: company.currentValue,
          },
          state.year === 4,
        );
        return {
          investedAmount: sum.investedAmount + item.investedAmount,
          evaluatedAmount: sum.evaluatedAmount + item.evaluatedAmount,
        };
      },
      { investedAmount: 0, evaluatedAmount: 0 },
    );
    const payout = Math.max(0, Math.floor(valuation.evaluatedAmount));

    const endingCash = user.cash + payout;
    await this.supabase.from("users").update({ cash: endingCash }).eq("id", userId);
    const { data: yearlyResult } = await this.supabase
      .from("user_yearly_results")
      .select("withdrawn_amount")
      .eq("user_id", userId)
      .eq("year", state.year)
      .maybeSingle();
    if (yearlyResult) {
      await this.supabase
        .from("user_yearly_results")
        .update({
          withdrawn_amount: Number(yearlyResult.withdrawn_amount ?? 0) + payout,
          ending_cash: endingCash,
          updated_at: now(),
        })
        .eq("user_id", userId)
        .eq("year", state.year);
    }
    await this.supabase
      .from("companies")
      .update({
        total_investment: Math.max(0, company.totalInvestment - valuation.investedAmount),
        updated_at: now(),
      })
      .eq("id", companyId);
    await this.supabase.from("investments").delete().eq("user_id", userId).eq("company_id", companyId);
    const { data: log } = await this.supabase
      .from("transactions")
      .insert({
        user_id: userId,
        user_name: user.realName,
        company_id: companyId,
        company_name: company.name,
        amount: payout,
        action_type: "WITHDRAW",
        year: state.year,
      })
      .select("*")
      .single();

    return {
      logId: log.id,
      userId: log.user_id,
      userName: log.user_name,
      companyId: log.company_id,
      companyName: log.company_name,
      amount: log.amount,
      actionType: log.action_type,
      year: log.year,
      createdAt: log.created_at,
    };
  }

  async setStatus(status: GameStatus, durationSeconds?: number) {
    const state = await this.getState();
    const { data: currentSession } = await this.supabase
      .from("game_status")
      .select("*")
      .eq("id", DEFAULT_SESSION_ID)
      .single();
    const previousPausedSeconds =
      (currentSession as DbSession | null)?.paused_remaining_seconds ?? null;
    const previousStatus = ((currentSession as DbSession | null)?.status ?? state.status) as GameStatus;
    const resumesPausedTimer =
      isTimedPlayStatus(status) &&
      !durationSeconds &&
      Boolean(previousPausedSeconds);
    await this.supabase
      .from("game_status")
      .update({
        year: status === "REALTIME_ROUND" || status === "ROUND_INVESTING" ? 4 : state.year,
        current_round:
          status === "ROUND_INVESTING" && previousStatus !== "ROUND_RESULT"
            ? 1
            : state.currentRound,
        max_rounds: MAX_ROUNDS,
        previous_status: state.status,
        status,
        timer_ends_at:
          durationSeconds && isTimedPlayStatus(status)
            ? new Date(Date.now() + durationSeconds * 1000).toISOString()
            : resumesPausedTimer
              ? new Date(Date.now() + Number(previousPausedSeconds) * 1000).toISOString()
              : status === "INVEST_CLOSED" || status === "PAUSED" || status === "FINISHED" || status === "SETTLED"
              ? null
              : state.timerEndsAt,
        paused_remaining_seconds:
          status === "PAUSED"
            ? state.remainingSeconds
            : durationSeconds ||
                resumesPausedTimer ||
                status === "INVEST_CLOSED" ||
                status === "FINISHED" ||
                status === "SETTLED"
              ? null
              : previousPausedSeconds,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);

    if (status === "REALTIME_ROUND" || status === "ROUND_INVESTING") {
      const createdAt = now();
      for (const company of state.companies) {
        const hasYearOpeningPoint = company.history.some(
          (point) => point.year === 4 && point.tick === 0,
        );
        if (!hasYearOpeningPoint) {
          await this.supabase.from("company_value_history").insert({
            company_id: company.id,
            tick: 0,
            year: 4,
            value: company.currentValue,
            change_rate: 0,
            recorded_at: createdAt,
          });
        }
      }
    }
  }

  async setPersonalRankingRevealed(revealed: boolean) {
    await this.supabase
      .from("game_status")
      .update({ personal_ranking_revealed: revealed, updated_at: now() })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async paySalary() {
    const state = await this.getState();
    for (const user of state.participants) {
      const salary = salaryTable[user.companyId][user.rank];
      await this.supabase.from("users").update({ cash: user.cash + salary }).eq("id", user.id);
      await this.supabase.from("transactions").insert({
        user_id: user.id,
        user_name: user.realName,
        company_id: user.companyId,
        company_name: user.companyName,
        amount: salary,
        action_type: "SALARY",
        year: state.year,
      });
    }
    await this.setStatus("SALARY_PAID");
  }

  async settleYear(changes: Partial<Record<CompanyId, number>>) {
    const state = await this.getState();
    const nextCompanies = new Map<CompanyId, Company>();
    for (const company of state.companies) {
      const change = changes[company.id] ?? 0;
      const nextValue = clampCompanyValue(company.currentValue * (1 + change / 100));
      nextCompanies.set(company.id, { ...company, previousValue: company.currentValue, currentValue: nextValue });
      await this.supabase
        .from("companies")
        .update({
          previous_value: company.currentValue,
          current_value: nextValue,
          change_rate: change,
          updated_at: now(),
        })
        .eq("id", company.id);
      await this.supabase.from("company_value_history").insert({
        company_id: company.id,
        tick: company.history.length,
        year: state.year,
        value: nextValue,
        change_rate: change,
        recorded_at: now(),
      });
    }
    const { data: investments } = await this.supabase
      .from("investments")
      .select("*")
      .eq("year", state.year);
    const settledInvestments: DbInvestment[] = [];
    for (const investment of (investments ?? []) as DbInvestment[]) {
      const company = nextCompanies.get(investment.company_id);
      if (!company) continue;
      const evaluated = calculateEvaluatedInvestment(investment, {
        ...company,
        initial_capital: company.initialCapital,
        current_value: company.currentValue,
      });
      const settledInvestment = {
        ...investment,
        evaluated_amount: evaluated.evaluatedAmount,
        profit_rate: evaluated.profitRate,
      };
      settledInvestments.push(settledInvestment);
      await this.supabase
        .from("investments")
        .update({
          evaluated_amount: evaluated.evaluatedAmount,
          profit_rate: evaluated.profitRate,
          updated_at: now(),
        })
        .eq("id", investment.id);
    }

    const yearlyResults = state.participants.map((user) => {
      const userInvestments = settledInvestments.filter((investment) => investment.user_id === user.id);
      const investedAmount = userInvestments.reduce((sum, item) => sum + getInvestmentAmount(item), 0);
      const evaluatedAmount = userInvestments.reduce((sum, item) => sum + Number(item.evaluated_amount ?? 0), 0);
      const profitAmount = evaluatedAmount - investedAmount;
      return {
        user_id: user.id,
        year: state.year,
        starting_cash: user.cash,
        invested_amount: investedAmount,
        evaluated_amount: evaluatedAmount,
        profit_amount: profitAmount,
        withdrawn_amount: 0,
        ending_cash: user.cash,
        total_asset: user.cash + evaluatedAmount,
        return_rate: investedAmount === 0 ? 0 : (profitAmount / investedAmount) * 100,
        updated_at: now(),
      };
    });
    if (yearlyResults.length > 0) {
      await this.supabase
        .from("user_yearly_results")
        .upsert(yearlyResults, { onConflict: "user_id,year" });
    }

    await this.supabase.from("transactions").insert({
      user_id: "admin",
      user_name: "운영자",
      company_id: "sanghyun",
      company_name: "정산",
      amount: 0,
      action_type: "SETTLEMENT",
      year: state.year,
    });
    await this.setStatus("SETTLED");
  }

  async advanceYear() {
    const state = await this.getState();
    const nextYear = Math.min(4, state.year + 1);
    await this.supabase
      .from("game_status")
      .update({
        year: nextYear,
        current_round: nextYear === 4 ? 1 : state.currentRound,
        max_rounds: MAX_ROUNDS,
        previous_status: state.status,
        status: nextYear === 4 ? "ROUND_INVESTING" : "YEAR_ENDED",
        timer_ends_at: null,
        paused_remaining_seconds: null,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async retreatYear() {
    const state = await this.getState();
    if (state.year <= 1) {
      throw new Error("이미 1년차입니다.");
    }
    const previousYear = Math.max(1, state.year - 1);
    await this.supabase
      .from("game_status")
      .update({
        year: previousYear,
        previous_status: state.status,
        status: "YEAR_ENDED",
        timer_ends_at: null,
        paused_remaining_seconds: null,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async advanceRound() {
    const state = await this.getState();
    if (state.currentRound >= state.maxRounds) {
      await this.setStatus("FINISHED");
      return;
    }
    await this.supabase
      .from("game_status")
      .update({
        current_round: state.currentRound + 1,
        previous_status: state.status,
        status: "ROUND_INVESTING",
        timer_ends_at: null,
        paused_remaining_seconds: null,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async settleRound() {
    await this.realtimeTick();
    const state = await this.getState();
    await this.supabase
      .from("game_status")
      .update({
        previous_status: state.status,
        status: "ROUND_RESULT",
        timer_ends_at: null,
        paused_remaining_seconds: null,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async withdrawAllRoundInvestments() {
    const state = await this.getState();
    const { data: investments } = await this.supabase
      .from("investments")
      .select("*")
      .eq("year", state.year);
    const payoutsByUser = new Map<string, number>();
    const yearlySnapshots = new Map<
      string,
      { startingCash: number; investedAmount: number; evaluatedAmount: number; payout: number }
    >();
    const investedByCompany = new Map<CompanyId, number>();
    const logs: Array<{
      user_id: string;
      user_name: string;
      company_id: CompanyId;
      company_name: string;
      amount: number;
      action_type: "WITHDRAW";
      year: number;
    }> = [];

    for (const investment of ((investments ?? []) as DbInvestment[]).filter(
      (item) => getInvestmentAmount(item) > 0,
    )) {
      const user = state.users.find((item) => item.id === investment.user_id);
      const company = state.companies.find((item) => item.id === investment.company_id);
      if (!user || !company) continue;
      const valuation = calculateEvaluatedInvestment(investment, {
        initial_capital: company.initialCapital,
        current_value: company.currentValue,
      });
      const payout = Math.max(0, Math.floor(valuation.evaluatedAmount));
      payoutsByUser.set(user.id, (payoutsByUser.get(user.id) ?? 0) + payout);
      const snapshot = yearlySnapshots.get(user.id) ?? {
        startingCash: user.cash,
        investedAmount: 0,
        evaluatedAmount: 0,
        payout: 0,
      };
      snapshot.investedAmount += valuation.investedAmount;
      snapshot.evaluatedAmount += valuation.evaluatedAmount;
      snapshot.payout += payout;
      yearlySnapshots.set(user.id, snapshot);
      investedByCompany.set(
        company.id,
        (investedByCompany.get(company.id) ?? 0) + valuation.investedAmount,
      );
      logs.push({
        user_id: user.id,
        user_name: user.realName,
        company_id: company.id,
        company_name: company.name,
        amount: payout,
        action_type: "WITHDRAW",
        year: state.year,
      });
    }

    for (const [userId, payout] of payoutsByUser.entries()) {
      const user = state.users.find((item) => item.id === userId);
      if (!user) continue;
      const endingCash = user.cash + payout;
      await this.supabase.from("users").update({ cash: endingCash }).eq("id", userId);
      const { data: yearlyResult } = await this.supabase
        .from("user_yearly_results")
        .select("withdrawn_amount")
        .eq("user_id", userId)
        .eq("year", state.year)
        .maybeSingle();
      if (yearlyResult) {
        await this.supabase
          .from("user_yearly_results")
          .update({
            withdrawn_amount: Number(yearlyResult.withdrawn_amount ?? 0) + payout,
            ending_cash: endingCash,
            total_asset: endingCash,
            updated_at: now(),
          })
          .eq("user_id", userId)
          .eq("year", state.year);
      } else {
        const snapshot = yearlySnapshots.get(userId);
        if (!snapshot) continue;
        const profitAmount = snapshot.evaluatedAmount - snapshot.investedAmount;
        await this.supabase.from("user_yearly_results").insert({
          user_id: userId,
          year: state.year,
          starting_cash: snapshot.startingCash,
          invested_amount: snapshot.investedAmount,
          evaluated_amount: snapshot.evaluatedAmount,
          profit_amount: profitAmount,
          withdrawn_amount: snapshot.payout,
          ending_cash: endingCash,
          total_asset: endingCash,
          return_rate: snapshot.investedAmount === 0 ? 0 : (profitAmount / snapshot.investedAmount) * 100,
          updated_at: now(),
        });
      }
    }
    for (const [companyId, investedAmount] of investedByCompany.entries()) {
      const company = state.companies.find((item) => item.id === companyId);
      if (!company) continue;
      await this.supabase
        .from("companies")
        .update({
          total_investment: Math.max(0, company.totalInvestment - investedAmount),
          updated_at: now(),
        })
        .eq("id", companyId);
    }
    if (logs.length > 0) {
      await this.supabase.from("transactions").insert(logs);
    }
    await this.supabase.from("investments").delete().eq("year", state.year);
  }

  async realtimeTick() {
    const state = await this.getState();
    const { data: logs } = await this.supabase
      .from("transactions")
      .select("*")
      .eq("year", state.year)
      .in("action_type", ["INVEST", "WITHDRAW"]);
    const realtimeLogs = (logs ?? []) as DbLog[];
    const orderScores = state.companies.map((company) => {
      const yearHistory = company.history.filter((point) => point.year === state.year);
      const lastPoint = yearHistory[yearHistory.length - 1];
      return getRealtimeOrderScore(realtimeLogs, company.id, state.year, lastPoint?.createdAt ?? null);
    });
    const recentInvestmentAmounts = state.companies.map((company) =>
      getRecentInvestmentAmount(realtimeLogs, company.id, state.year),
    );
    const totalRecentInvestment = recentInvestmentAmounts.reduce((sum, amount) => sum + amount, 0);

    for (const [index, company] of state.companies.entries()) {
      const nextValue = calculateRealtimeValue(
        company.currentValue,
        orderScores,
        orderScores[index] ?? 0,
        totalRecentInvestment > 0 ? (recentInvestmentAmounts[index] ?? 0) / totalRecentInvestment : 0,
      );
      await this.supabase
        .from("companies")
        .update({
          previous_value: company.currentValue,
          current_value: nextValue,
          updated_at: now(),
        })
        .eq("id", company.id);
      await this.supabase.from("company_value_history").insert({
        company_id: company.id,
        tick: company.history.length,
        year: state.year,
        value: nextValue,
        change_rate:
          company.currentValue === 0 ? 0 : ((nextValue - company.currentValue) / company.currentValue) * 100,
        recorded_at: now(),
      });
    }
  }

  async publishNews(title: string, content: string) {
    await this.supabase.from("news").insert({ title, content });
  }

  async publishAnnouncement(content: string) {
    await this.supabase.from("announcements").insert({ content });
  }

  async updateUser(
    userId: string,
    patch: Partial<Pick<User, "realName" | "companyId" | "rank" | "cash">>,
  ) {
    const updates: Record<string, unknown> = {};
    if (patch.realName !== undefined) updates.real_name = patch.realName;
    if (patch.companyId !== undefined) updates.company_id = patch.companyId;
    if (patch.rank !== undefined) updates.rank = patch.rank;
    if (patch.cash !== undefined) updates.cash = Math.max(0, Math.floor(Number(patch.cash)));
    if (Object.keys(updates).length === 0) return;
    updates.updated_at = now();
    await this.supabase.from("users").update(updates).eq("id", userId).eq("role", "participant");
  }

  async updateCompany(
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue" | "logoUrl" | "tagline">>,
  ) {
    const state = await this.getState();
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) throw new Error("수정할 기업을 찾을 수 없습니다.");

    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.logoUrl !== undefined) updates.logo_url = patch.logoUrl;
    if (patch.tagline !== undefined) updates.tagline = patch.tagline;
    if (patch.initialCapital !== undefined) {
      updates.initial_capital = Math.max(1, Math.floor(Number(patch.initialCapital)));
    }
    if (patch.currentValue !== undefined) {
      updates.previous_value = company.currentValue;
      updates.current_value = clampCompanyValue(Number(patch.currentValue));
      await this.supabase.from("company_value_history").insert({
        company_id: companyId,
        tick: company.history.length,
        year: state.year,
        value: updates.current_value,
      });
    }
    if (Object.keys(updates).length === 0) return;
    updates.updated_at = now();
    await this.supabase.from("companies").update(updates).eq("id", companyId);
  }

  async reset(scope = "all") {
    if (scope === "logs") {
      await this.supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await this.supabase.from("user_yearly_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return;
    }
    if (scope === "assets") {
      await this.supabase.from("investments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await this.supabase.from("user_yearly_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      for (const seed of userSeeds) {
        await this.supabase.from("users").update({ cash: seed.cash }).eq("id", seed.id);
      }
      return;
    }
    await Promise.all([
      this.supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      this.supabase.from("user_yearly_results").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      this.supabase.from("investments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      this.supabase.from("company_value_history").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      this.supabase.from("news").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      this.supabase.from("announcements").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    ]);
    await this.supabase.from("users").delete().neq("id", "__never__");
    await this.supabase.from("companies").delete().neq("id", "__never__");
    await this.supabase.from("game_status").delete().eq("id", DEFAULT_SESSION_ID);
    await this.initialize();
  }
}

export const createStore = (): Store => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    return new SupabaseStore(createClient(supabaseUrl, supabaseKey));
  }

  return new MemoryStore();
};
