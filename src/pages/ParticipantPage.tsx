import { Bell, LogIn, Newspaper, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompanyCard } from "../components/CompanyCard";
import { HeaderStats } from "../components/HeaderStats";
import { InvestmentSheet } from "../components/InvestmentSheet";
import { api, connectRealtime, disconnectRealtime } from "../lib/api";
import type { Company, CompanyId, GameState, User } from "../types";
import { formatPercent, formatValue, formatWon } from "../utils/format";

type ParticipantPageProps = {
  state: GameState | null;
  setState: (state: GameState) => void;
  connected: boolean;
};

const canInvestInStatus = (status: GameState["status"]) =>
  status === "INVESTING" || status === "REALTIME_ROUND" || status === "ROUND_INVESTING";

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

const statusMessage: Record<GameState["status"], { title: string; body: string }> = {
  BEFORE_START: {
    title: "게임 시작 전입니다.",
    body: "관리자가 연봉 지급과 투자 시작을 진행하면 투자가 열립니다.",
  },
  SALARY_PAID: {
    title: "연봉이 지급되었습니다.",
    body: "아직 투자 시작 전입니다. 관리자 안내를 기다려 주세요.",
  },
  INVESTING: {
    title: "투자 가능 상태입니다.",
    body: "기업을 선택해 보유 현금 범위 안에서 투자할 수 있습니다.",
  },
  INVEST_CLOSED: {
    title: "투자가 마감되었습니다.",
    body: "정산 결과가 확정될 때까지 기다려 주세요.",
  },
  SETTLED: {
    title: "정산이 완료되었습니다.",
    body: "자산 변동과 현재 순위를 확인해 주세요.",
  },
  YEAR_ENDED: {
    title: "연차가 종료되었습니다.",
    body: "다음 연차 진행 전까지 대기해 주세요.",
  },
  REALTIME_ROUND: {
    title: "4년차 실시간 라운드입니다.",
    body: "실시간 그래프를 보며 마지막 투자를 진행할 수 있습니다.",
  },
  ROUND_INVESTING: {
    title: "4년차 라운드 투자 시간입니다.",
    body: "60초 동안 투자할 기업을 선택해 주세요.",
  },
  ROUND_RESULT: {
    title: "라운드 결과 공개 중입니다.",
    body: "잠시 후 투자금이 전액 자동 회수되고 다음 라운드가 시작됩니다.",
  },
  PAUSED: {
    title: "게임이 일시정지되었습니다.",
    body: "타이머와 투자가 잠시 멈췄습니다. 관리자 안내를 기다려 주세요.",
  },
  FINISHED: {
    title: "게임이 종료되었습니다.",
    body: "최종 결과는 전광판에서 확인해 주세요.",
  },
};

export function ParticipantPage({ state, setState, connected }: ParticipantPageProps) {
  const [userId, setUserId] = useState(() => sessionStorage.getItem("userId"));
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);
  const [withdrawingCompanyId, setWithdrawingCompanyId] = useState<CompanyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [feedSheet, setFeedSheet] = useState<"news" | "announcements" | null>(null);

  const user = useMemo<User | undefined>(
    () => state?.users.find((item) => item.id === userId && item.role === "participant"),
    [userId, state?.users],
  );

  const chartData = useMemo(() => {
    if (!state?.companies.length) return [];
    return state.companies[0].history.map((point, index) => {
      const row: Record<string, string | number> = { label: `${point.year}년차-${point.tick}` };
      state.companies.forEach((company) => {
        row[company.name] = company.history[index]?.value ?? company.currentValue;
      });
      return row;
    });
  }, [state?.companies]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      const response = await api.login(id, password);
      sessionStorage.setItem("userId", response.user.id);
      sessionStorage.setItem("sessionUserId", response.user.id);
      sessionStorage.setItem("sessionToken", response.sessionToken);
      connectRealtime(response.user.id, response.sessionToken);
      setUserId(response.user.id);
      setState(response.state);
      if (response.user.role === "admin") {
        window.history.replaceState(null, "", "/admin");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인에 실패했습니다.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const sessionToken = sessionStorage.getItem("sessionToken") ?? "";
    if (userId && sessionToken) {
      try {
        const response = await api.logout(userId, sessionToken);
        setState(response);
      } catch {
        // Local logout should still clear this device even if the network request fails.
      }
    }
    disconnectRealtime();
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("sessionUserId");
    sessionStorage.removeItem("sessionToken");
    setUserId(null);
  };

  const handleInvest = async (companyId: CompanyId, amount: number) => {
    if (!userId) return;
    const response = await api.invest(userId, companyId, amount);
    setState(response.state);
  };

  const handleWithdraw = async (companyId: CompanyId) => {
    if (!userId || withdrawingCompanyId) return;
    const shouldWithdraw = window.confirm("이 기업의 보유 투자금을 모두 전액 회수할까요?");
    if (!shouldWithdraw) return;

    setWithdrawingCompanyId(companyId);
    try {
      const response = await api.withdraw(userId, companyId);
      setState(response.state);
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "투자금 회수에 실패했습니다.");
    } finally {
      setWithdrawingCompanyId(null);
    }
  };

  if (!state) {
    return <LoadingView label="서버 상태를 불러오는 중" />;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
        <section className="mx-auto flex max-w-md flex-col gap-6">
          <div>
            <p className="brand-shine brand-shine-soft text-sm font-bold">인생여전</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">참가자 로그인</h1>
          </div>

          <form onSubmit={handleLogin} className="rounded-card border border-slate-200 bg-white p-6 shadow-soft">
            <label className="block">
              <span className="text-sm font-semibold text-slate-600">아이디</span>
              <input
                value={id}
                onChange={(event) => setId(event.target.value)}
                className="mt-3 h-[52px] w-full rounded-button border border-slate-200 bg-slate-50 px-4 text-lg font-semibold outline-none focus:border-slate-950 focus:bg-white"
                placeholder="예: p001"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-600">비밀번호</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-3 h-[52px] w-full rounded-button border border-slate-200 bg-slate-50 px-4 text-lg font-semibold outline-none focus:border-slate-950 focus:bg-white"
                placeholder="비밀번호"
                type="password"
              />
            </label>
            {error ? <p className="mt-3 text-sm font-semibold text-red-500">{error}</p> : null}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-button bg-slate-950 font-bold text-white disabled:bg-slate-300"
            >
              <LogIn size={18} aria-hidden />
              {isLoggingIn ? "로그인 중" : "로그인"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const canInvest = canInvestInStatus(state.status);
  const canWithdraw =
    state.status !== "FINISHED" &&
    state.status !== "ROUND_INVESTING" &&
    state.status !== "ROUND_RESULT";
  const isRoundResult = state.status === "ROUND_RESULT";
  const showCountdown = (canInvest || isRoundResult) && state.remainingSeconds > 0;
  const isLastTenSeconds = showCountdown && state.remainingSeconds <= 10;
  const activeHoldings = user.holdings.filter((holding) => holding.investedAmount > 0);
  const message = statusMessage[state.status];
  const latestNews = state.news[0];
  const latestAnnouncement = state.announcements[0];
  const showAnnouncementToast =
    latestAnnouncement && latestAnnouncement.id !== dismissedAnnouncementId;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {showAnnouncementToast ? (
        <section className="fixed left-3 right-3 top-3 z-40 mx-auto max-w-md rounded-card bg-slate-950 p-6 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400">공지</p>
              <p className="mt-1 text-sm font-semibold leading-5">{latestAnnouncement.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedAnnouncementId(latestAnnouncement.id)}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold"
            >
              닫기
            </button>
          </div>
        </section>
      ) : null}

      <HeaderStats
        realName={user.realName}
        companyName={user.companyName}
        cash={user.cash}
        evaluatedAmount={user.evaluatedAmount}
        totalAsset={user.totalAsset}
        returnRate={user.returnRate}
        year={state.year}
        connected={connected}
        onLogout={handleLogout}
      />

      <section className="mx-auto max-w-md space-y-5 px-5 pb-8 pt-5">
        <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">{message.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{message.body}</p>
              {state.year === 4 ? (
                <p className="mt-2 text-xs font-bold text-slate-400">
                  {state.currentRound}/{state.maxRounds} 라운드
                </p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {state.status}
            </span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <FeedShortcut
            icon={<Bell size={16} aria-hidden />}
            label="공지"
            title={latestAnnouncement?.content ?? "새 공지가 없습니다"}
            meta={state.announcements.length > 0 ? `${state.announcements.length}개` : "확인 완료"}
            onClick={() => setFeedSheet("announcements")}
          />
          <FeedShortcut
            icon={<Newspaper size={16} aria-hidden />}
            label="뉴스"
            title={latestNews ? `${latestNews.title} · ${latestNews.content}` : "새 뉴스가 없습니다"}
            meta={state.news.length > 0 ? `${state.news.length}개` : "대기 중"}
            onClick={() => setFeedSheet("news")}
          />
        </section>

        {showCountdown ? (
          <section
            className={`rounded-card p-6 shadow-soft ${
              isLastTenSeconds ? "bg-red-600 text-white" : "bg-white text-slate-950"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  className={`text-sm font-semibold ${
                    isLastTenSeconds ? "text-red-100" : "text-slate-500"
                  }`}
                >
                  {isRoundResult ? "다음 라운드까지" : "투자 가능 시간"}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {isRoundResult
                    ? "결과 공개 후 자동 전액 회수됩니다"
                    : isLastTenSeconds
                      ? "곧 마감됩니다"
                      : "시간 안에 투자를 완료해주세요"}
                </p>
              </div>
              <strong className="text-4xl font-bold tracking-normal">
                {formatTimer(state.remainingSeconds)}
              </strong>
            </div>
          </section>
        ) : null}

        <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">실시간 주식 그래프</h2>
            <span className="text-xs font-semibold text-slate-400">
              {state.year === 4 ? "4년차 라운드" : "연차별 가치"}
            </span>
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis dataKey="label" hide />
                <YAxis domain={["dataMin - 300", "dataMax + 300"]} width={92} tickFormatter={(value) => formatValue(Number(value))} />
                <Tooltip
                  formatter={(value) => formatValue(Number(value))}
                  labelFormatter={(label) => formatChartLabel(String(label))}
                />
                {state.companies.map((company) => (
                  <Line
                    key={company.id}
                    type="monotone"
                    dataKey={company.name}
                    stroke={company.color}
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={650}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {state.companies.map((company) => (
              <div key={company.id} className="rounded-button bg-slate-50 px-3 py-2">
                <p className="truncate text-xs font-bold" style={{ color: company.color }}>
                  {company.name}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-950">
                    {formatValue(company.currentValue)}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      company.changeRate >= 0 ? "text-red-500" : "text-blue-500"
                    }`}
                  >
                    {formatPercent(company.changeRate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold">내 보유 주식</h2>
          {activeHoldings.length === 0 ? (
            <div className="rounded-card border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              아직 투자한 기업이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {activeHoldings.map((holding) => (
                <div key={holding.companyId} className="rounded-card bg-white p-6 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{holding.companyName}</span>
                    <span
                      className={`text-sm font-bold ${
                        holding.returnRate >= 0 ? "text-red-500" : "text-blue-500"
                      }`}
                    >
                      {formatPercent(holding.returnRate)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <Info label="투자금" value={formatWon(holding.investedAmount)} />
                    <Info label="평가액" value={formatWon(holding.evaluatedAmount)} />
                    <Info label="기업가치" value={formatValue(holding.currentValue)} />
                  </div>
                  <button
                    type="button"
                    disabled={!canWithdraw || withdrawingCompanyId === holding.companyId}
                    onClick={() => handleWithdraw(holding.companyId)}
                    className="mt-4 h-[46px] w-full rounded-button border border-slate-200 bg-white text-sm font-bold text-slate-950 transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {withdrawingCompanyId === holding.companyId ? "전액 회수 중" : "전액 회수"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">투자 가능한 기업</h2>
            <span className="text-xs font-semibold text-slate-400">
              {canInvest ? "투자 가능" : "투자 불가"}
            </span>
          </div>
          <div className="space-y-4">
            {state.companies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                investedAmount={
                  user.holdings.find((holding) => holding.companyId === company.id)
                    ?.investedAmount ?? 0
                }
                evaluatedAmount={
                  user.holdings.find((holding) => holding.companyId === company.id)
                    ?.evaluatedAmount ?? 0
                }
                canInvest={canInvest}
                onSelect={setSelectedCompany}
              />
            ))}
          </div>
        </section>
      </section>

      <FeedSheet
        type={feedSheet}
        news={state.news}
        announcements={state.announcements}
        onClose={() => setFeedSheet(null)}
      />

      <InvestmentSheet
        company={selectedCompany}
        cash={user.cash}
        onClose={() => setSelectedCompany(null)}
        onInvest={handleInvest}
      />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function FeedShortcut({
  icon,
  label,
  title,
  meta,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-card bg-white p-4 text-left shadow-soft transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          {icon}
          {label}
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
          {meta}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-5 text-slate-950">
        {title}
      </p>
      <p className="mt-2 text-xs font-bold text-blue-600">전체보기</p>
    </button>
  );
}

function FeedSheet({
  type,
  news,
  announcements,
  onClose,
}: {
  type: "news" | "announcements" | null;
  news: { id: string; title: string; content: string; createdAt: string }[];
  announcements: { id: string; content: string; createdAt: string }[];
  onClose: () => void;
}) {
  if (!type) return null;

  const isNews = type === "news";
  const items = isNews
    ? news.map((item) => ({ id: item.id, title: item.title, body: item.content, createdAt: item.createdAt }))
    : announcements.map((item) => ({ id: item.id, title: "공지", body: item.content, createdAt: item.createdAt }));

  return (
    <section className="fixed inset-0 z-50 flex items-end bg-slate-950/40 px-3 pb-3" onClick={onClose}>
      <div
        className="mx-auto max-h-[72vh] w-full max-w-md overflow-hidden rounded-card bg-white shadow-2xl animate-in"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold text-slate-400">전체보기</p>
            <h2 className="text-lg font-bold">{isNews ? "뉴스" : "공지"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="max-h-[56vh] space-y-3 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="rounded-button bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
              아직 표시할 내용이 없습니다.
            </p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-button bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-950">{item.title}</h3>
                  <time className="shrink-0 text-[11px] font-semibold text-slate-400">
                    {formatFeedTime(item.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">{item.body}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function formatFeedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function formatChartLabel(label: string) {
  const match = label.match(/^(\d+).+-(\d+)$/);
  if (!match) return "가치 변동";
  return `${match[1]}년차 ${Number(match[2]) + 1}번째 변동`;
}

function LoadingView({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-500">
      <p className="font-semibold">{label}</p>
    </main>
  );
}
