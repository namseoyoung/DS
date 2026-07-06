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
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-4 text-white sm:px-6 sm:py-5 lg:h-screen lg:overflow-hidden">
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_0.85fr] lg:gap-5">
          <section className="rounded-card bg-white p-4 text-slate-950 sm:p-5">
            <h2 className="text-lg font-bold sm:text-xl">실시간 기업 가치 그래프</h2>
            <div className="mt-3 h-[245px] sm:h-[285px] lg:h-[270px] xl:h-[290px]">
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
            <CompanyTopFive companies={state.companies.slice(0, 5)} />
          </section>

          <section className="grid gap-4">
            <Panel title="개인 자산 6-10위">
              {state.personalRankingRevealed ? (
                state.participants.slice(5, 10).map((user) => (
                  <RankLine
                    key={user.id}
                    rank={user.personalRank ?? 0}
                    name={user.realName}
                    main={formatWon(user.totalAsset)}
                    sub={user.companyName + " · " + formatPercent(user.returnRate)}
                  />
                ))
              ) : (
                <HiddenRanking />
              )}
            </Panel>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-5">
          <NewsFeed icon={<Newspaper size={20} />} title="최신 뉴스" items={state.news} />
          <Feed icon={<Bell size={20} />} title="최신 공지" items={state.announcements.map((item) => item.content)} />
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
    <section className="rounded-card bg-white p-4 text-slate-950 sm:p-5">
      <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}


function CompanyTopFive({ companies }: { companies: GameState["companies"] }) {
  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-base font-bold sm:text-lg">기업 TOP5</h3>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {companies.map((company) => (
          <div key={company.id} className="min-w-0 rounded-button bg-slate-50 px-2 py-3 text-center">
            <p className="text-sm font-black text-slate-400">{company.rank}</p>
            <div className="mt-1 flex justify-center">
              <CompanyAvatar logoUrl={company.logoUrl} color={company.color} name={company.name} compact />
            </div>
            <p className="mt-2 truncate text-sm font-bold">{company.name}</p>
            <p className="mt-1 truncate text-sm font-black sm:text-base">{formatValue(company.currentValue)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RankLine({
  rank,
  name,
  main,
  sub,
  logoUrl,
  avatarColor,
}: {
  rank: number;
  name: string;
  main: string;
  sub?: string;
  logoUrl?: string;
  avatarColor?: string;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-button bg-slate-50 p-3 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:items-center">
      <span className="self-center text-xl font-bold text-slate-400 sm:text-2xl">{rank}</span>
      <div className="flex min-w-0 items-center gap-3">
        {logoUrl || avatarColor ? (
          <CompanyAvatar logoUrl={logoUrl} color={avatarColor} name={name} />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-base font-bold sm:text-lg">{name}</p>
          {sub ? <p className="truncate text-xs text-slate-500 sm:text-sm">{sub}</p> : null}
        </div>
      </div>
      <span className="col-span-2 text-right text-lg font-bold sm:col-span-1 sm:text-xl">{main}</span>
    </div>
  );
}

function CompanyAvatar({
  logoUrl,
  color,
  name,
  compact,
}: {
  logoUrl?: string;
  color?: string;
  name: string;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-10 w-10 sm:h-11 sm:w-11";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-slate-200`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full text-sm font-black text-white`}
      style={{ backgroundColor: color ?? "#0f172a" }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function HiddenRanking() {
  return (
    <div className="space-y-3">
      {[6, 7, 8, 9, 10].map((rank) => (
        <div key={rank} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-button bg-slate-50 p-3 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:items-center">
          <span className="self-center text-xl font-bold text-slate-300 sm:text-2xl">{rank}</span>
          <div className="min-w-0">
            <p className="h-5 w-28 rounded-full bg-slate-200" />
            <p className="mt-2 h-3 w-40 rounded-full bg-slate-100" />
          </div>
          <span className="col-span-2 text-right text-sm font-bold text-slate-400 sm:col-span-1 sm:text-base">공개 대기</span>
        </div>
      ))}
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
    <section className="rounded-card bg-white/10 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
        {icon}
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-slate-300">표시할 내용이 없습니다.</p>
        ) : (
          items.slice(0, 3).map((item) => (
            <p key={item} className="truncate rounded-button bg-white/10 px-3 py-1.5 text-xs sm:text-sm">
              {item}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

function NewsFeed({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: GameState["news"];
}) {
  return (
    <section className="rounded-card bg-white/10 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
        {icon}
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-slate-300">표시할 내용이 없습니다.</p>
        ) : (
          items.slice(0, 3).map((item) => (
            <article key={item.id} className="overflow-hidden rounded-button bg-white/10">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" />
              ) : null}
              <p className="truncate px-3 py-1.5 text-xs sm:text-sm">
                {item.title}: {item.content}
              </p>
            </article>
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
