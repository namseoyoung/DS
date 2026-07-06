import {
  Activity,
  Bell,
  Clock3,
  Crown,
  LockKeyhole,
  Newspaper,
  Trophy,
  UserRound,
} from "lucide-react";
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
    return (
      <main className="grid min-h-screen place-items-center bg-[#020712] text-white">
        서버에 연결 중입니다
      </main>
    );
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

  const chartData = buildChartData(state);
  const latestNews = state.news[0];
  const latestAnnouncement = state.announcements[0];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020712] px-5 py-5 text-white lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(39,132,255,0.35),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(91,78,255,0.24),transparent_24%),linear-gradient(180deg,#040915,#01040c)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[240px] opacity-70 [background-image:linear-gradient(90deg,transparent_0%,rgba(58,146,255,0.26)_50%,transparent_100%),radial-gradient(circle_at_55%_36%,rgba(93,171,255,0.65),transparent_4%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(70,143,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(70,143,255,0.28)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative mx-auto flex h-full max-w-[1580px] flex-col gap-4">
        <header className="grid gap-4 lg:grid-cols-[1fr_470px] lg:items-end">
          <div className="relative min-w-0">
            <div className="pointer-events-none absolute left-[340px] top-0 hidden h-36 w-[580px] rounded-full bg-[radial-gradient(circle,rgba(48,140,255,0.36),transparent_58%)] blur-sm lg:block" />
            <p className="flex items-center gap-2 text-lg font-black tracking-wide text-[#38bdf8]">
              <span className="h-4 w-4 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.95)]" />
              {connected ? "LIVE" : "RECONNECTING"} · {state.year}년차 · {statusLabel[state.status]}
            </p>
            <h1 className="brand-shine mt-1 text-[clamp(4.5rem,7.2vw,7rem)] font-black leading-none tracking-normal text-white drop-shadow-[0_0_26px_rgba(96,165,250,0.42)]">
              인생여전
            </h1>
            <p className="mt-2 text-xl font-semibold text-blue-200">
              기업 가치로 경쟁하는 실시간 투자 시뮬레이션
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <DisplayStat
              icon={<Clock3 size={30} />}
              label="남은 시간"
              value={formatTimer(state.remainingSeconds)}
              urgent={state.remainingSeconds > 0 && state.remainingSeconds <= 10}
            />
            <DisplayStat
              icon={<UserRound size={30} />}
              label="접속"
              value={`${state.connectedCount}/${state.capacity}`}
            />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.38fr_0.62fr]">
          <section className="min-h-0 rounded-[20px] border border-blue-400/55 bg-[#041127]/82 p-5 shadow-[0_0_38px_rgba(37,99,235,0.24)] backdrop-blur">
            <h2 className="flex items-center gap-3 text-2xl font-black">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-500/15 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                <Activity size={27} />
              </span>
              실시간 기업 가치 그래프
            </h2>

            <div className="mt-3 h-[312px] xl:h-[336px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 14, right: 24, left: 14, bottom: 8 }}>
                  <defs>
                    <filter id="displayGlow" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid stroke="#12345f" strokeDasharray="4 4" />
                  <XAxis dataKey="label" hide />
                  <YAxis
                    domain={["dataMin - 500", "dataMax + 500"]}
                    width={98}
                    tickFormatter={(value) => formatValue(Number(value))}
                    tick={{ fontSize: 12, fill: "#dbeafe", fontWeight: 700 }}
                    axisLine={{ stroke: "#5b8fe8" }}
                    tickLine={{ stroke: "#5b8fe8" }}
                  />
                  <Tooltip
                    formatter={(value) => formatValue(Number(value))}
                    labelFormatter={(label) => formatChartLabel(String(label))}
                    contentStyle={{
                      background: "rgba(5, 14, 34, 0.94)",
                      border: "1px solid rgba(96,165,250,0.55)",
                      borderRadius: 14,
                      color: "#fff",
                      boxShadow: "0 0 28px rgba(37,99,235,0.35)",
                    }}
                  />
                  {state.companies.map((company) => (
                    <Line
                      key={company.id}
                      type="monotone"
                      dataKey={company.name}
                      stroke={company.color}
                      strokeWidth={4}
                      dot={false}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                      filter="url(#displayGlow)"
                      isAnimationActive
                      animationDuration={650}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <CompanyTopFive companies={state.companies.slice(0, 5)} />
          </section>

          <RankingBoard state={state} />
        </div>

        <BottomTicker news={latestNews} announcement={latestAnnouncement?.content} />
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
              <Info
                label="소속 평균 자산"
                value={topCompany ? formatWon(topCompany.memberAverageAsset) : "-"}
              />
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

function buildChartData(state: GameState) {
  const maxLength = Math.max(1, ...state.companies.map((company) => company.history.length));

  return Array.from({ length: maxLength }, (_, index) => {
    const firstPoint = state.companies.find((company) => company.history[index])?.history[index];
    const row: Record<string, string | number> = {
      label: firstPoint ? `${firstPoint.year}년차-${firstPoint.tick}` : `${state.year}년차-${index}`,
    };

    state.companies.forEach((company) => {
      row[company.name] = company.history[index]?.value ?? company.currentValue;
    });

    return row;
  });
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function DisplayStat({
  icon,
  label,
  value,
  urgent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <section
      className={`rounded-[20px] border px-7 py-5 shadow-[0_0_32px_rgba(37,99,235,0.18)] backdrop-blur ${
        urgent
          ? "border-red-300/80 bg-red-600/35 text-white"
          : "border-blue-300/50 bg-[#06152f]/82 text-white"
      }`}
    >
      <p className="flex items-center gap-3 text-lg font-black text-blue-100">
        <span className={urgent ? "text-red-100" : "text-blue-300"}>{icon}</span>
        {label}
      </p>
      <p className="mt-4 whitespace-nowrap font-mono text-[clamp(2.8rem,4.2vw,4.3rem)] font-black leading-none tracking-normal text-white drop-shadow-[0_0_18px_rgba(96,165,250,0.45)]">
        {value}
      </p>
    </section>
  );
}

function CompanyTopFive({ companies }: { companies: GameState["companies"] }) {
  return (
    <section className="mt-4 border-t border-blue-300/18 pt-3">
      <h3 className="flex items-center gap-2 text-2xl font-black">
        <span className="text-blue-400">★</span>
        기업 TOP5
      </h3>
      <div className="mt-3 grid grid-cols-5 gap-4">
        {companies.map((company) => (
          <article
            key={company.id}
            className="relative min-w-0 overflow-hidden rounded-[14px] border border-blue-300/50 bg-[#06152f]/88 p-4 text-center shadow-[inset_0_0_24px_rgba(59,130,246,0.12),0_0_24px_rgba(37,99,235,0.18)]"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: company.color }} />
            <span className="absolute left-1/2 top-2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-blue-600 text-lg font-black shadow-[0_0_18px_rgba(59,130,246,0.8)]">
              {company.rank}
            </span>
            <div className="mt-10 flex justify-center">
              <CompanyAvatar logoUrl={company.logoUrl} color={company.color} name={company.name} compact />
            </div>
            <p className="mt-3 truncate text-lg font-black">{company.name}</p>
            <p className="mt-2 truncate text-xl font-black" style={{ color: company.color }}>
              {formatValue(company.currentValue)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingBoard({ state }: { state: GameState }) {
  return (
    <aside className="rounded-[20px] border border-blue-300/50 bg-[#041127]/82 p-5 shadow-[0_0_38px_rgba(37,99,235,0.24)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-blue-300/22 pb-4">
        <h2 className="flex items-center gap-3 text-2xl font-black">
          <Crown className="text-blue-300" size={31} />
          개인 자산 6-10위
        </h2>
        <span className="rounded-full border border-blue-300/35 bg-blue-500/12 px-4 py-2 text-sm font-black text-blue-100">
          {state.personalRankingRevealed ? "공개 중" : "공개 전"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {state.personalRankingRevealed
          ? state.participants.slice(5, 10).map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[54px_1fr_auto] items-center gap-4 rounded-[14px] border border-blue-300/20 bg-[#071832]/82 px-5 py-4 shadow-[inset_0_0_18px_rgba(59,130,246,0.08)]"
              >
                <span className="font-mono text-3xl font-black text-blue-300">{user.personalRank}</span>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-white">{user.realName}</p>
                  <p className="truncate text-sm font-bold text-blue-200/75">{user.companyName}</p>
                </div>
                <span className="text-lg font-black text-white">{formatWon(user.totalAsset)}</span>
              </div>
            ))
          : [6, 7, 8, 9, 10].map((rank) => (
              <div
                key={rank}
                className="grid grid-cols-[54px_1fr_auto] items-center gap-4 rounded-[14px] border border-blue-300/20 bg-[#071832]/82 px-5 py-4 shadow-[inset_0_0_18px_rgba(59,130,246,0.08)]"
              >
                <span className="font-mono text-3xl font-black text-blue-300">{rank}</span>
                <span className="h-8 w-32 rounded-full bg-blue-300/10" />
                <span className="flex items-center gap-4 text-base font-bold text-blue-100">
                  공개 대기
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-blue-300/20 bg-blue-950/60 text-blue-300">
                    <LockKeyhole size={22} />
                  </span>
                </span>
              </div>
            ))}
      </div>
    </aside>
  );
}

function BottomTicker({
  news,
  announcement,
}: {
  news?: GameState["news"][number];
  announcement?: string;
}) {
  return (
    <footer className="grid gap-4 lg:grid-cols-2">
      <InfoTicker
        icon={<Newspaper size={26} />}
        title="최신 뉴스"
        imageUrl={news?.imageUrl}
        headline={news?.title ?? "새 뉴스가 없습니다"}
        body={news?.content ?? "뉴스가 발송되면 이곳에 표시됩니다."}
      />
      <InfoTicker
        icon={<Bell size={26} />}
        title="최신 공지"
        headline={latestAnnouncementTitle(announcement)}
        body={announcement ?? "표시할 내용이 없습니다."}
      />
    </footer>
  );
}

function InfoTicker({
  icon,
  title,
  headline,
  body,
  imageUrl,
}: {
  icon: ReactNode;
  title: string;
  headline: string;
  body: string;
  imageUrl?: string;
}) {
  return (
    <section className="rounded-[18px] border border-blue-300/35 bg-[#041127]/86 p-4 shadow-[0_0_28px_rgba(37,99,235,0.18)]">
      <h2 className="flex items-center gap-3 text-2xl font-black">
        <span className="text-blue-300">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 flex items-center gap-4 rounded-[14px] border border-blue-300/16 bg-[#071832]/80 p-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-16 w-28 shrink-0 rounded-[10px] object-cover" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-blue-600 text-2xl font-black text-white">
            i
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">{headline}</p>
          <p className="mt-1 truncate text-sm font-semibold text-blue-100/75">{body}</p>
        </div>
      </div>
    </section>
  );
}

function latestAnnouncementTitle(announcement?: string) {
  if (!announcement) return "표시할 내용이 없습니다";
  return announcement.length > 24 ? `${announcement.slice(0, 24)}...` : announcement;
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
  const sizeClass = compact ? "h-14 w-14" : "h-10 w-10 sm:h-11 sm:w-11";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-blue-300/35`}
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

function formatChartLabel(label: string) {
  const match = label.match(/^(\d+)년차-(\d+)$/);
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
