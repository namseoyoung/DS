import {
  Bell,
  Clock,
  Lock,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trophy,
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Company, CompanyId, GameState, GameStatus, JobRank, User } from "../types";
import { formatPercent, formatValue, formatWon } from "../utils/format";

type AdminPageProps = {
  state: GameState | null;
  setState: (state: GameState) => void;
  connected: boolean;
};

const statusLabels: Record<GameStatus, string> = {
  BEFORE_START: "시작 전",
  SALARY_PAID: "연봉 지급 완료",
  INVESTING: "투자 진행",
  INVEST_CLOSED: "투자 마감",
  SETTLED: "정산 완료",
  YEAR_ENDED: "연차 종료",
  REALTIME_ROUND: "4년차 실시간 라운드",
  PAUSED: "일시정지",
  FINISHED: "종료",
};

const jobRanks: JobRank[] = ["사원", "대리", "과장", "차장", "부장"];
const quickAnnouncements = [
  "투자가 1분 후 마감됩니다.",
  "뉴스가 공개되었습니다.",
  "모든 참가자는 결과를 확인해주세요.",
  "투자가 종료되었습니다.",
  "다음 연차가 시작됩니다.",
];

export function AdminPage({ state, setState, connected }: AdminPageProps) {
  const [adminId, setAdminId] = useState(() => sessionStorage.getItem("adminId") ?? "");
  const [id, setId] = useState("admin");
  const [password, setPassword] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [duration, setDuration] = useState("600");
  const [settlement, setSettlement] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const admin = state?.users.find((user) => user.id === adminId && user.role === "admin");

  const stats = useMemo(() => {
    if (!state) return { invested: 0, averageAsset: 0, todayLogs: 0 };
    const invested = state.companies.reduce((sum, company) => sum + company.totalInvestment, 0);
    const averageAsset =
      state.participants.length === 0
        ? 0
        : state.participants.reduce((sum, user) => sum + user.totalAsset, 0) /
          state.participants.length;
    const today = new Date().toDateString();
    const todayLogs = state.logs.filter((log) => new Date(log.createdAt).toDateString() === today).length;
    return { invested, averageAsset, todayLogs };
  }, [state]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      const response = await api.login(id, password);
      if (response.user.role !== "admin") {
        setError("관리자 계정이 아닙니다.");
        return;
      }
      sessionStorage.setItem("adminId", response.user.id);
      setAdminId(response.user.id);
      setState(response.state);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "관리자 로그인에 실패했습니다.");
    }
  };

  const run = async (action: () => Promise<GameState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      setState(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "관리자 작업에 실패했습니다.");
    }
  };

  const editUser = (user: User) => {
    const nickname = window.prompt("닉네임", user.nickname);
    if (nickname === null) return;
    const realName = window.prompt("실명", user.realName);
    if (realName === null) return;
    const companyId = window.prompt(
      `소속 회사 ID (${state?.companies.map((company) => company.id).join(", ")})`,
      user.companyId,
    ) as CompanyId | null;
    if (companyId === null) return;
    const rank = window.prompt(`직급 (${jobRanks.join(", ")})`, user.rank) as JobRank | null;
    if (rank === null) return;
    const cash = window.prompt("보유 현금", String(user.cash));
    if (cash === null) return;

    run(() =>
      api.updateUser(admin!.id, user.id, {
        nickname,
        realName,
        companyId,
        rank,
        cash: Number(cash),
      }),
    );
  };

  const editCompany = (company: Company) => {
    const name = window.prompt("기업명", company.name);
    if (name === null) return;
    const initialCapital = window.prompt("초기 자본", String(company.initialCapital));
    if (initialCapital === null) return;
    const currentValue = window.prompt("현재 기업 가치", String(company.currentValue));
    if (currentValue === null) return;

    run(() =>
      api.updateCompany(admin!.id, company.id, {
        name,
        initialCapital: Number(initialCapital),
        currentValue: Number(currentValue),
      }),
    );
  };

  if (!admin) {
    return (
      <main className="min-h-screen bg-blue-600 px-5 py-8 text-white">
        <form onSubmit={handleLogin} className="mx-auto max-w-md rounded-card bg-white p-6 text-slate-950 shadow-soft">
          <Lock size={28} aria-hidden />
          <h1 className="mt-4 text-2xl font-bold">관리자 로그인</h1>
          <input
            value={id}
            onChange={(event) => setId(event.target.value)}
            className="mt-5 h-[52px] w-full rounded-button border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-blue-600"
            placeholder="아이디"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-3 h-[52px] w-full rounded-button border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-blue-600"
            placeholder="비밀번호"
            type="password"
          />
          {error ? <p className="mt-3 text-sm font-semibold text-red-500">{error}</p> : null}
          <button className="mt-5 h-[52px] w-full rounded-button bg-blue-600 font-bold text-white">
            입장
          </button>
        </form>
      </main>
    );
  }

  if (!state) {
    return <main className="grid min-h-screen place-items-center bg-slate-50">불러오는 중</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <section className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              {connected ? "실시간 연결" : "재연결 중"} · 접속 {state.connectedCount}/{state.capacity}명
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {state.year}년차 · {statusLabels[state.status]} · 남은 시간 {formatTimer(state.remainingSeconds)}
            </h1>
          </div>
          <a href="/display" className="flex h-[52px] items-center rounded-button bg-blue-600 px-4 text-sm font-bold text-white">
            전광판 열기
          </a>
        </section>
      </header>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {error ? <p className="rounded-card bg-red-50 p-6 text-sm font-semibold text-red-600">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="총 참가자 수" value={`${state.participants.length}명`} />
          <Stat label="총 투자금" value={formatWon(stats.invested)} />
          <Stat label="평균 자산" value={formatWon(stats.averageAsset)} />
          <Stat label="오늘 거래 수" value={`${stats.todayLogs}건`} />
        </div>

        <section className="rounded-card bg-white p-6 shadow-soft">
          <h2 className="font-bold">게임 진행 컨트롤</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Control icon={<RefreshCw size={16} />} label="연봉 지급" onClick={() => run(() => api.paySalary(admin.id))} />
            <Control icon={<Play size={16} />} label="투자 시작" onClick={() => run(() => api.setStatus(admin.id, "INVESTING", Number(duration)))} />
            <Control icon={<Clock size={16} />} label="투자 마감" onClick={() => run(() => api.setStatus(admin.id, "INVEST_CLOSED"))} />
            <Control icon={<Trophy size={16} />} label="정산 확정" onClick={() => run(() => api.settle(admin.id, parseSettlement(settlement)), "정산을 확정할까요?")} />
            <Control icon={<SkipBack size={16} />} label="이전 연차" onClick={() => run(() => api.retreatYear(admin.id), "이전 연차로 돌아갈까요?")} />
            <Control icon={<SkipForward size={16} />} label="다음 연차" onClick={() => run(() => api.advanceYear(admin.id), "다음 연차로 이동할까요?")} />
            <Control icon={<Play size={16} />} label="4년차 라운드 시작" onClick={() => run(() => api.setStatus(admin.id, "REALTIME_ROUND", Number(duration)))} />
            <Control icon={<RefreshCw size={16} />} label="4년차 가치 갱신" onClick={() => run(() => api.realtimeTick(admin.id))} />
            <Control icon={<Pause size={16} />} label="일시정지" onClick={() => run(() => api.setStatus(admin.id, "PAUSED"))} />
            <Control icon={<Play size={16} />} label="재개" onClick={() => run(() => api.setStatus(admin.id, state.previousStatus ?? "INVESTING"))} />
            <Control icon={<Trophy size={16} />} label="게임 종료" onClick={() => run(() => api.setStatus(admin.id, "FINISHED"), "게임을 종료할까요?")} />
            <Control icon={<RotateCcw size={16} />} label="전체 초기화" danger onClick={() => run(() => api.reset(admin.id), "전체 데이터를 초기화할까요?")} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <label className="md:col-span-1">
              <span className="text-xs font-semibold text-slate-500">투자 시간(초)</span>
              <input value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1 h-[52px] w-full rounded-button border border-slate-200 px-3" />
            </label>
            {state.companies.map((company) => (
              <label key={company.id}>
                <span className="text-xs font-semibold text-slate-500">{company.name} 변동률</span>
                <input
                  value={settlement[company.id] ?? ""}
                  onChange={(event) => setSettlement((current) => ({ ...current, [company.id]: event.target.value }))}
                  className="mt-1 h-[52px] w-full rounded-button border border-slate-200 px-3"
                  placeholder="+20"
                />
              </label>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="font-bold">회원 관리</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th>실명</th>
                    <th>닉네임</th>
                    <th>회사</th>
                    <th>직급</th>
                    <th>현금</th>
                    <th>평가금</th>
                    <th>총자산</th>
                    <th>수익률</th>
                    <th>접속</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.participants.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="py-3 font-bold">{user.realName}</td>
                      <td>{user.nickname}</td>
                      <td>{user.companyName}</td>
                      <td>{user.rank}</td>
                      <td>{formatWon(user.cash)}</td>
                      <td>{formatWon(user.evaluatedAmount)}</td>
                      <td className="font-bold">{formatWon(user.totalAsset)}</td>
                      <td>{formatPercent(user.returnRate)}</td>
                      <td>{user.isOnline ? "온라인" : "오프라인"}</td>
                      <td>
                        <button onClick={() => editUser(user)} className="rounded-button border border-slate-200 px-3 py-2 font-bold">
                          수정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <Panel title="개인 랭킹">
              {state.participants.slice(0, 8).map((user) => (
                <RankItem
                  key={user.id}
                  rank={user.personalRank ?? 0}
                  name={user.realName}
                  subName={user.nickname}
                  value={formatWon(user.totalAsset)}
                  caption={user.companyName}
                />
              ))}
            </Panel>

            <Panel title="기업 랭킹">
              {state.companies.map((company) => (
                <RankItem
                  key={company.id}
                  rank={company.rank}
                  name={company.name}
                  value={`${formatValue(company.currentValue)} · ${formatWon(company.totalInvestment)}`}
                  caption={formatPercent(company.changeRate)}
                />
              ))}
            </Panel>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="font-bold">기업 관리</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {state.companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => editCompany(company)}
                  className="rounded-card border border-slate-200 p-5 text-left"
                >
                  <p className="font-bold">{company.name}</p>
                  <p className="mt-2 text-sm text-slate-500">현재 가치 {formatValue(company.currentValue)}</p>
                  <p className="text-sm text-slate-500">초기 자본 {formatValue(company.initialCapital)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="font-bold">최근 거래 로그</h2>
            <div className="mt-4 space-y-2">
              {state.logs.slice(0, 10).map((log) => (
                <p key={log.logId} className="rounded-button bg-slate-50 px-3 py-2 text-sm">
                  {new Date(log.createdAt).toLocaleTimeString("ko-KR")} · {log.userName} → {log.companyName} {formatWon(log.amount)} {log.actionType}
                </p>
              ))}
              {state.logs.length === 0 ? <p className="text-sm text-slate-500">아직 거래 로그가 없습니다.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-bold"><Newspaper size={18} />뉴스 발송</h2>
            <input value={newsTitle} onChange={(event) => setNewsTitle(event.target.value)} className="mt-4 h-[52px] w-full rounded-button border border-slate-200 px-4" placeholder="뉴스 제목" />
            <textarea value={newsContent} onChange={(event) => setNewsContent(event.target.value)} className="mt-3 min-h-28 w-full rounded-button border border-slate-200 p-4" placeholder="뉴스 내용" />
            <button
              onClick={() => run(() => api.publishNews(admin.id, newsTitle, newsContent))}
              className="mt-3 h-[52px] w-full rounded-button bg-blue-600 font-bold text-white"
            >
              뉴스 발송
            </button>
          </section>

          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-bold"><Bell size={18} />공지 발송</h2>
            <textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} className="mt-4 min-h-28 w-full rounded-button border border-slate-200 p-4" placeholder="공지 내용" />
            <div className="mt-3 flex flex-wrap gap-2">
              {quickAnnouncements.map((item) => (
                <button key={item} onClick={() => setAnnouncement(item)} className="rounded-button border border-slate-200 px-3 py-2 text-sm font-bold">
                  {item}
                </button>
              ))}
            </div>
            <button
              onClick={() => run(() => api.publishAnnouncement(admin.id, announcement))}
              className="mt-3 h-[52px] w-full rounded-button bg-blue-600 font-bold text-white"
            >
              공지 발송
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}

function parseSettlement(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value.trim() !== "")
      .map(([companyId, value]) => [companyId, Number(value)]),
  ) as Partial<Record<CompanyId, number>>;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-card bg-white p-6 shadow-soft">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </section>
  );
}

function Control({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[52px] items-center gap-2 rounded-button px-4 text-sm font-bold ${
        danger ? "bg-red-600 text-white" : "bg-blue-600 text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-white p-6 shadow-soft">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function RankItem({
  rank,
  name,
  subName,
  value,
  caption,
}: {
  rank: number;
  name: string;
  subName?: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-button bg-slate-50 p-3">
      <span className="w-8 text-xl font-bold text-slate-400">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        {subName ? <p className="truncate text-xs font-semibold text-slate-400">{subName}</p> : null}
        <p className="truncate text-sm text-slate-500">{caption}</p>
      </div>
      <span className="font-bold">{value}</span>
    </div>
  );
}
