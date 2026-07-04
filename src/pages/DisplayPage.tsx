import { Bell, Newspaper, Trophy } from "lucide-react";
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
import type { GameState } from "../types";
import { formatPercent, formatValue, formatWon } from "../utils/format";

type DisplayPageProps = {
  state: GameState | null;
  connected: boolean;
};

const statusLabel: Record<GameState["status"], string> = {
  BEFORE_START: "시작 전",
  SALARY_PAID: "연봉 지급 완료",
  INVESTING: "투자 진행",
  INVEST_CLOSED: "투자 마감",
  SETTLED: "정산 완료",
  YEAR_ENDED: "연차 종료",
  REALTIME_ROUND: "4년차 실시간 라운드",
  ROUND_INVESTING: "4년차 라운드 투자",
  ROUND_RESULT: "4년차 결과 공개",
  PAUSED: "일시정지",
  FINISHED: "종료",
};

export function DisplayPage({ state, connected }: DisplayPageProps) {
  if (!state) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">연결 중</main>;
  }

  if (state.status === "FINISHED") {
    return <Ending state={state} connected={connected} />;
  }

  if (state.remainingSeconds > 0 && state.remainingSeconds <= 10) {
    return (
      <main className="grid min-h-screen place-items-center bg-red-700 text-white">
        <section className="text-center">
          <p className="text-3xl font-bold text-red-100">투자 종료 카운트다운</p>
          <p className="mt-8 text-[180px] font-black leading-none">{state.remainingSeconds}</p>
        </section>
      </main>
    );
  }

  const chartData = state.companies[0]?.history.map((point, index) => {
    const row: Record<string, string | number> = { label: `${point.year}년차-${point.tick}` };
    state.companies.forEach((company) => {
      row[company.name] = company.history[index]?.value ?? company.currentValue;
    });
    return row;
  });

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-6">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-4 lg:flex lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold leading-5 text-slate-400 sm:text-sm">
              {connected ? "LIVE" : "RECONNECTING"} · {state.year}년차 · {statusLabel[state.status]}
              {state.year === 4 ? ` · ${state.currentRound}/${state.maxRounds} 라운드` : ""}
            </p>
            <h1 className="brand-shine mt-2 break-keep text-3xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">인생여전</h1>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-left sm:gap-3 sm:text-right lg:w-auto lg:min-w-[340px]">
            <DisplayStat
              label="남은 시간"
              value={formatTimer(state.remainingSeconds)}
              urgent={state.remainingSeconds > 0 && state.remainingSeconds <= 10}
            />
            <DisplayStat label="접속" value={`${state.connectedCount}/${state.capacity}`} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:mt-6 lg:grid-cols-[1.35fr_0.9fr] lg:gap-5">
          <section className="rounded-card bg-white p-5 text-slate-950 sm:p-6">
            <h2 className="text-lg font-bold sm:text-xl">실시간 기업 가치 그래프</h2>
            <div className="mt-4 h-[300px] sm:h-[410px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#e2e8f0" />
                  <XAxis dataKey="label" hide />
                  <YAxis domain={["dataMin - 500", "dataMax + 500"]} width={72} tickFormatter={(value) => formatValue(Number(value))} tick={{ fontSize: 10 }} />
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
                      strokeWidth={4}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      isAnimationActive
                      animationDuration={650}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-5">
            <Panel title="기업 TOP5">
              {state.companies.slice(0, 5).map((company) => (
                <RankLine
                  key={company.id}
                  rank={company.rank}
                  name={company.name}
                  main={formatValue(company.currentValue)}
                  sub={`${formatPercent(company.changeRate)} · ${formatWon(company.totalInvestment)}`}
                />
              ))}
            </Panel>
            <Panel title="개인 자산 TOP5">
              {state.participants.slice(0, 5).map((user) => (
                <RankLine
                  key={user.id}
                  rank={user.personalRank ?? 0}
                  name={user.realName}
                  main={formatWon(user.totalAsset)}
                  sub={`${user.companyName} · ${formatPercent(user.returnRate)}`}
                />
              ))}
            </Panel>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-3 lg:gap-5">
          <Feed icon={<Newspaper size={20} />} title="최신 뉴스" items={state.news.map((item) => `${item.title}: ${item.content}`)} />
          <Feed icon={<Bell size={20} />} title="최신 공지" items={state.announcements.map((item) => item.content)} />
          <section className="rounded-card bg-white/10 p-6">
            <h2 className="text-xl font-bold">최근 투자 로그</h2>
            <div className="mt-4 space-y-2">
              {state.logs.slice(0, 5).map((log) => (
                <p key={log.logId} className="rounded-button bg-white/10 px-3 py-2 text-sm">
                  {log.userName} → {log.companyName} {formatWon(log.amount)}
                </p>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Ending({ state, connected }: { state: GameState; connected: boolean }) {
  const topCompany = state.companies[0];
  const winner = state.participants[0];
  const companyMembers = state.participants.filter((user) => user.companyId === topCompany?.id);

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold text-amber-300">{connected ? "FINAL" : "OFFLINE"}</p>
        <div className="mt-5 flex items-center gap-4">
          <Trophy className="text-amber-300" size={72} aria-hidden />
          <div>
            <h1 className="text-6xl font-bold tracking-normal">최종 엔딩</h1>
            <p className="mt-3 text-2xl text-slate-300">기업 1등과 개인 자산 1등을 공개합니다.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-card bg-white p-8 text-slate-950">
            <p className="text-lg font-semibold text-slate-500">최종 우승 기업</p>
            <p className="mt-3 text-5xl font-bold">{topCompany?.name ?? "-"}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Info label="최종 가치" value={topCompany ? formatValue(topCompany.currentValue) : "-"} />
              <Info label="총 투자금" value={topCompany ? formatWon(topCompany.totalInvestment) : "-"} />
              <Info label="소속 평균 자산" value={topCompany ? formatWon(topCompany.memberAverageAsset) : "-"} />
            </div>
            <p className="mt-6 text-sm font-semibold text-slate-500">소속 회원</p>
            <p className="mt-2 text-xl font-bold">
              {companyMembers.length === 0 ? "없음" : companyMembers.map((user) => user.realName).join(", ")}
            </p>
          </section>

          <section className="rounded-card bg-white p-8 text-slate-950">
            <p className="text-lg font-semibold text-slate-500">개인 자산 1등</p>
            <p className="mt-3 text-5xl font-bold">{winner?.realName ?? "-"}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Info label="소속 회사" value={winner?.companyName ?? "-"} />
              <Info label="최종 자산" value={winner ? formatWon(winner.totalAsset) : "-"} />
              <Info label="수익률" value={winner ? formatPercent(winner.returnRate) : "-"} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function DisplayStat({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-[18px] px-3 py-3 sm:rounded-card sm:px-5 sm:py-4 ${urgent ? "bg-red-600" : "bg-white/10"}`}>
      <p className={`whitespace-nowrap text-[11px] font-semibold leading-none sm:text-sm ${urgent ? "text-red-100" : "text-slate-300"}`}>{label}</p>
      <p className="mt-2 whitespace-nowrap font-mono text-[clamp(1.35rem,7vw,2rem)] font-bold leading-none tracking-normal sm:text-3xl">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-white p-5 text-slate-950 sm:p-6">
      <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function RankLine({
  rank,
  name,
  main,
  sub,
}: {
  rank: number;
  name: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-2 rounded-button bg-slate-50 p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center">
      <span className="text-xl font-bold text-slate-400 sm:text-2xl">{rank}</span>
      <div>
        <p className="truncate text-base font-bold sm:text-lg">{name}</p>
        <p className="truncate text-xs text-slate-500 sm:text-sm">{sub}</p>
      </div>
      <span className="col-span-2 text-right text-lg font-bold sm:col-span-1 sm:text-xl">{main}</span>
    </div>
  );
}

function Feed({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-card bg-white/10 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
        {icon}
        {title}
      </h2>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-slate-300">표시할 내용이 없습니다.</p>
        ) : (
          items.slice(0, 4).map((item) => (
            <p key={item} className="rounded-button bg-white/10 px-3 py-2 text-sm">
              {item}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

function formatChartLabel(label: string) {
  const match = label.match(/^(\d+).+-(\d+)$/);
  if (!match) return "가치 변동";
  return `${match[1]}년차 ${Number(match[2]) + 1}번째 변동`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-slate-50 p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}
