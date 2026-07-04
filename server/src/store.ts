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
  personal_ranking_visible?: boolean | null;
  capacity: number;
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

export type Store = {
  initialize(): Promise<void>;
  getState(): Promise<GameState>;
  login(id: string, password: string): Promise<User>;
  invest(userId: string, companyId: CompanyId, amount: number): Promise<TransactionLog>;
  withdraw(userId: string, companyId: CompanyId): Promise<TransactionLog>;
  setStatus(status: GameStatus, durationSeconds?: number): Promise<void>;
  paySalary(): Promise<void>;
  settleYear(changes: Partial<Record<CompanyId, number>>): Promise<void>;
  advanceYear(): Promise<void>;
  retreatYear(): Promise<void>;
  setPersonalRankingVisible(visible: boolean): Promise<void>;
  realtimeTick(): Promise<void>;
  publishNews(title: string, content: string): Promise<void>;
  publishAnnouncement(content: string): Promise<void>;
  updateUser(
    userId: string,
    patch: Partial<Pick<User, "nickname" | "realName" | "companyId" | "rank" | "cash">>,
  ): Promise<void>;
  updateCompany(
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue">>,
  ): Promise<void>;
  reset(scope?: string): Promise<void>;
};

const getRemainingSeconds = (timerEndsAt: string | null) => {
  if (!timerEndsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(timerEndsAt) - Date.now()) / 1000));
};

const getInvestmentAmount = (investment: DbInvestment) =>
  Number(investment.invested_amount ?? investment.amount ?? 0);

const canWithdrawInStatus = (status: GameStatus) =>
  status === "INVEST_CLOSED" || status === "SETTLED" || status === "YEAR_ENDED";

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

const calculateCompanyScore = (company: Company) => company.currentValue + company.memberAverageAsset * 0;

const calculateState = (
  session: DbSession,
  companiesRaw: DbCompany[],
  usersRaw: DbUser[],
  investments: DbInvestment[],
  history: DbHistory[],
  logs: DbLog[],
  news: NewsItem[],
  announcements: Announcement[],
): GameState => {
  const useRealtimeValuation = session.year === 4 && session.status === "REALTIME_ROUND";
  const companiesWithoutRank = companiesRaw.map<Company>((company) => {
    const totalInvestment = investments
      .filter((investment) => investment.company_id === company.id)
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
      rank: 0,
      color: company.color,
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
      nickname: user.nickname,
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
    personalRankingVisible: Boolean(session.personal_ranking_visible),
    connectedCount: users.filter((user) => user.isOnline).length,
    capacity: session.capacity,
    companies,
    users,
    participants,
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
    personal_ranking_visible: false,
    capacity: CAPACITY,
    updated_at: now(),
  };

  private companies: DbCompany[] = [];
  private users: DbUser[] = [];
  private investments: DbInvestment[] = [];
  private history: DbHistory[] = [];
  private logs: DbLog[] = [];
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
        nickname: user.nickname,
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
      this.news,
      this.announcements,
    );
  }

  async login(id: string, password: string) {
    const user = this.users.find((item) => item.id === id && item.password === password);
    if (!user) throw new Error("?꾩씠???먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎.");
    user.is_online = true;
    this.session.updated_at = now();
    const state = await this.getState();
    return state.users.find((item) => item.id === user.id)!;
  }

  async invest(userId: string, companyId: CompanyId, amount: number) {
    if (!isInvestableStatus(this.session.status)) {
      throw new Error("?꾩옱???ъ옄 媛???곹깭媛 ?꾨떃?덈떎.");
    }

    const user = this.users.find((item) => item.id === userId);
    const company = this.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("?ъ옄???뚯썝 ?먮뒗 湲곗뾽??李얠쓣 ???놁뒿?덈떎.");
    }
    if (amount <= 0 || amount > user.cash) {
      throw new Error("蹂댁쑀 ?꾧툑蹂대떎 留롮씠 ?ъ옄?????놁뒿?덈떎.");
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

    const log = this.addLog(user.id, user.nickname, company.id, company.name, amount, "INVEST");
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
    if (!canWithdrawInStatus(this.session.status)) {
      throw new Error("?꾩옱???ъ옄湲덉쓣 ?뚯닔?????놁뒿?덈떎.");
    }

    const user = this.users.find((item) => item.id === userId);
    const company = this.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("?뚯닔???뚯썝 ?먮뒗 湲곗뾽??李얠쓣 ???놁뒿?덈떎.");
    }

    const userInvestments = this.investments.filter(
      (investment) => investment.user_id === userId && investment.company_id === companyId,
    );
    if (userInvestments.length === 0) {
      throw new Error("?뚯닔???ъ옄湲덉씠 ?놁뒿?덈떎.");
    }

    const withdrawalAmount = userInvestments.reduce((sum, investment) => {
      const valuation = calculateVisibleInvestment(investment, company, false);
      return sum + valuation.evaluatedAmount;
    }, 0);

    user.cash += Math.round(withdrawalAmount);
    this.investments = this.investments.filter(
      (investment) => !(investment.user_id === userId && investment.company_id === companyId),
    );

    const log = this.addLog(user.id, user.nickname, company.id, company.name, Math.round(withdrawalAmount), "WITHDRAW");
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
    this.session.previous_status = this.session.status;
    this.session.status = status;
    if (status === "PAUSED") {
      this.session.paused_remaining_seconds = remainingSeconds;
      this.session.timer_ends_at = null;
    } else if (durationSeconds && (status === "INVESTING" || status === "REALTIME_ROUND")) {
      this.session.timer_ends_at = new Date(Date.now() + durationSeconds * 1000).toISOString();
      this.session.paused_remaining_seconds = null;
    } else if (
      (status === "INVESTING" || status === "REALTIME_ROUND") &&
      this.session.paused_remaining_seconds
    ) {
      this.session.timer_ends_at = new Date(
        Date.now() + this.session.paused_remaining_seconds * 1000,
      ).toISOString();
      this.session.paused_remaining_seconds = null;
    } else if (status === "INVEST_CLOSED" || status === "FINISHED") {
      this.session.timer_ends_at = null;
      this.session.paused_remaining_seconds = null;
    }
    this.session.updated_at = now();
  }

  async paySalary() {
    for (const user of this.users.filter((item) => item.role === "participant")) {
      const salary = salaryTable[user.company_id][user.rank];
      user.cash += salary;
      const company = this.companies.find((item) => item.id === user.company_id)!;
      this.addLog(user.id, user.nickname, company.id, company.name, salary, "SALARY");
    }
    await this.setStatus("SALARY_PAID");
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
    this.addLog("admin", "운영자", "sanghyun", "정산", 0, "SETTLEMENT");
    await this.setStatus("SETTLED");
  }

  async advanceYear() {
    this.session.year = Math.min(4, this.session.year + 1);
    await this.setStatus(this.session.year === 4 ? "REALTIME_ROUND" : "YEAR_ENDED");
  }

  async retreatYear() {
    if (this.session.year <= 1) {
      throw new Error("?대? 1?꾩감?낅땲??");
    }
    this.session.year = Math.max(1, this.session.year - 1);
    await this.setStatus("YEAR_ENDED");
  }

  async setPersonalRankingVisible(visible: boolean) {
    this.session.personal_ranking_visible = visible;
    this.session.updated_at = now();
  }

  async realtimeTick() {
    const totalInvestment = this.investments.reduce(
      (sum, investment) => sum + getInvestmentAmount(investment),
      0,
    );
    for (const company of this.companies) {
      const companyInvestment = this.investments
        .filter((investment) => investment.company_id === company.id)
        .reduce((sum, investment) => sum + getInvestmentAmount(investment), 0);
      const tick = this.history.filter((point) => point.company_id === company.id).length;
      const nextValue = calculateRealtimeValue(
        company.current_value,
        totalInvestment,
        companyInvestment,
        tick,
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
    patch: Partial<Pick<User, "nickname" | "realName" | "companyId" | "rank" | "cash">>,
  ) {
    const user = this.users.find((item) => item.id === userId);
    if (!user || user.role !== "participant") throw new Error("?섏젙???뚯썝??李얠쓣 ???놁뒿?덈떎.");
    if (patch.nickname !== undefined) user.nickname = patch.nickname;
    if (patch.realName !== undefined) user.real_name = patch.realName;
    if (patch.companyId !== undefined) user.company_id = patch.companyId;
    if (patch.rank !== undefined) user.rank = patch.rank;
    if (patch.cash !== undefined) user.cash = Math.max(0, Math.floor(Number(patch.cash)));
    this.session.updated_at = now();
  }

  async updateCompany(
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue">>,
  ) {
    const company = this.companies.find((item) => item.id === companyId);
    if (!company) throw new Error("?섏젙??湲곗뾽??李얠쓣 ???놁뒿?덈떎.");
    if (patch.name !== undefined) company.name = patch.name;
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
      personal_ranking_visible: false,
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
      personal_ranking_visible: false,
      capacity: CAPACITY,
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
          nickname: user.nickname,
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
      { data: news },
      { data: announcements },
    ] = await Promise.all([
      this.supabase.from("game_status").select("*").eq("id", DEFAULT_SESSION_ID).single(),
      this.supabase.from("companies").select("*").order("id"),
      this.supabase.from("users").select("*").order("id"),
      this.supabase.from("investments").select("*").order("created_at", { ascending: false }),
      this.supabase.from("company_value_history").select("*").order("tick"),
      this.supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      this.supabase.from("news").select("*").order("created_at", { ascending: false }).limit(20),
      this.supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!session || !companies || !users || !investments || !history || !logs) {
      throw new Error("Supabase ?곹깭瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
    }

    return calculateState(
      session as DbSession,
      companies as DbCompany[],
      users as DbUser[],
      investments as DbInvestment[],
      history as DbHistory[],
      logs as DbLog[],
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
    if (!user) throw new Error("?꾩씠???먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎.");
    await this.supabase.from("users").update({ is_online: true }).eq("id", id);
    return (await this.getState()).users.find((item) => item.id === id)!;
  }

  async invest(userId: string, companyId: CompanyId, amount: number) {
    const state = await this.getState();
    if (!isInvestableStatus(state.status)) throw new Error("?꾩옱???ъ옄 媛???곹깭媛 ?꾨떃?덈떎.");
    const user = state.users.find((item) => item.id === userId);
    const company = state.companies.find((item) => item.id === companyId);
    if (!user || !company || user.role !== "participant") {
      throw new Error("?ъ옄???뚯썝 ?먮뒗 湲곗뾽??李얠쓣 ???놁뒿?덈떎.");
    }
    if (amount <= 0 || amount > user.cash) {
      throw new Error("蹂댁쑀 ?꾧툑蹂대떎 留롮씠 ?ъ옄?????놁뒿?덈떎.");
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
        user_name: user.nickname,
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
    if (!canWithdrawInStatus(state.status)) {
      throw new Error("현재는 투자금을 회수할 수 없습니다.");
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
    const userInvestments = (investments ?? []) as DbInvestment[];
    if (userInvestments.length === 0) {
      throw new Error("회수할 투자금이 없습니다.");
    }

    const withdrawalAmount = Math.round(
      userInvestments.reduce((sum, investment) => {
        const valuation = calculateVisibleInvestment(
          investment,
          {
            initial_capital: company.initialCapital,
            current_value: company.currentValue,
          },
          false,
        );
        return sum + valuation.evaluatedAmount;
      }, 0),
    );

    await this.supabase.from("users").update({ cash: user.cash + withdrawalAmount }).eq("id", userId);
    await this.supabase.from("investments").delete().eq("user_id", userId).eq("company_id", companyId);
    const { data: log } = await this.supabase
      .from("transactions")
      .insert({
        user_id: userId,
        user_name: user.nickname,
        company_id: companyId,
        company_name: company.name,
        amount: withdrawalAmount,
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
  }  async setStatus(status: GameStatus, durationSeconds?: number) {
    const state = await this.getState();
    const { data: currentSession } = await this.supabase
      .from("game_status")
      .select("*")
      .eq("id", DEFAULT_SESSION_ID)
      .single();
    const previousPausedSeconds =
      (currentSession as DbSession | null)?.paused_remaining_seconds ?? null;
    const resumesPausedTimer =
      (status === "INVESTING" || status === "REALTIME_ROUND") &&
      !durationSeconds &&
      Boolean(previousPausedSeconds);
    await this.supabase
      .from("game_status")
      .update({
        previous_status: state.status,
        status,
        timer_ends_at:
          durationSeconds && (status === "INVESTING" || status === "REALTIME_ROUND")
            ? new Date(Date.now() + durationSeconds * 1000).toISOString()
            : resumesPausedTimer
              ? new Date(Date.now() + Number(previousPausedSeconds) * 1000).toISOString()
              : status === "INVEST_CLOSED" || status === "PAUSED" || status === "FINISHED"
              ? null
              : state.timerEndsAt,
        paused_remaining_seconds:
          status === "PAUSED"
            ? state.remainingSeconds
            : durationSeconds ||
                resumesPausedTimer ||
                status === "INVEST_CLOSED" ||
                status === "FINISHED"
              ? null
              : previousPausedSeconds,
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async paySalary() {
    const state = await this.getState();
    for (const user of state.participants) {
      const salary = salaryTable[user.companyId][user.rank];
      await this.supabase.from("users").update({ cash: user.cash + salary }).eq("id", user.id);
      await this.supabase.from("transactions").insert({
        user_id: user.id,
        user_name: user.nickname,
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
    for (const investment of (investments ?? []) as DbInvestment[]) {
      const company = nextCompanies.get(investment.company_id);
      if (!company) continue;
      const evaluated = calculateEvaluatedInvestment(investment, {
        ...company,
        initial_capital: company.initialCapital,
        current_value: company.currentValue,
      });
      await this.supabase
        .from("investments")
        .update({
          evaluated_amount: evaluated.evaluatedAmount,
          profit_rate: evaluated.profitRate,
          updated_at: now(),
        })
        .eq("id", investment.id);
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
        previous_status: state.status,
        status: nextYear === 4 ? "REALTIME_ROUND" : "YEAR_ENDED",
        updated_at: now(),
      })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async retreatYear() {
    const state = await this.getState();
    if (state.year <= 1) {
      throw new Error("?대? 1?꾩감?낅땲??");
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

  async setPersonalRankingVisible(visible: boolean) {
    await this.supabase
      .from("game_status")
      .update({ personal_ranking_visible: visible, updated_at: now() })
      .eq("id", DEFAULT_SESSION_ID);
  }

  async realtimeTick() {
    const state = await this.getState();
    const totalInvestment = state.companies.reduce((sum, company) => sum + company.totalInvestment, 0);
    for (const company of state.companies) {
      const nextValue = calculateRealtimeValue(
        company.currentValue,
        totalInvestment,
        company.totalInvestment,
        company.history.length,
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
    patch: Partial<Pick<User, "nickname" | "realName" | "companyId" | "rank" | "cash">>,
  ) {
    const updates: Record<string, unknown> = {};
    if (patch.nickname !== undefined) updates.nickname = patch.nickname;
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
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue">>,
  ) {
    const state = await this.getState();
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) throw new Error("?섏젙??湲곗뾽??李얠쓣 ???놁뒿?덈떎.");

    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
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
      return;
    }
    if (scope === "assets") {
      await this.supabase.from("investments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      for (const seed of userSeeds) {
        await this.supabase.from("users").update({ cash: seed.cash }).eq("id", seed.id);
      }
      return;
    }
    await Promise.all([
      this.supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
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
