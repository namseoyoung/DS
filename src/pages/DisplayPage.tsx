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
    <main className="relative h-screen overflow-hidden bg-[#020712] px-4 py-3 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_49%_5%,rgba(58,126,255,0.34),transparent_25%),radial-gradient(circle_at_77%_13%,rgba(80,71,255,0.2),transparent_20%),linear-gradient(180deg,#050a18,#01040c)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[185px] opacity-70 [background-image:linear-gradient(90deg,transparent_0%,rgba(58,146,255,0.26)_50%,transparent_100%),radial-gradient(circle_at_56%_32%,rgba(116,176,255,0.62),transparent_5%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(70,143,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(70,143,255,0.28)_1px,transparent_1px)] [background-size:64px_64px]" />

      <section className="relative mx-auto flex h-full max-w-[1120px] flex-col gap-2.5">
        <header className="grid shrink-0 grid-cols-[1fr_320px] items-end gap-4">
          <div className="relative min-w-0">
            <div className="pointer-events-none absolute left-[255px] top-0 hidden h-24 w-[420px] rounded-full bg-[radial-gradient(circle,rgba(48,140,255,0.34),transparent_58%)] blur-sm lg:block" />
            <p className="flex items-center gap-1.5 text-[13px] font-black tracking-wide text-[#38bdf8]">
              <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
              {connected ? "LIVE" : "RECONNECTING"} · {state.year}년차 · {statusLabel[state.status]}
            </p>
            <h1 className="brand-shine mt-0.5 text-[64px] font-black leading-none tracking-normal text-white drop-shadow-[0_0_24px_rgba(96,165,250,0.42)]">
              인생여전
            </h1>
            <p className="mt-1 text-sm font-semibold text-blue-200">
              기업 가치로 경쟁하는 실시간 투자 시뮬레이션
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DisplayStat
              icon={<Clock3 size={18} />}
              label="남은 시간"
              value={formatTimer(state.remainingSeconds)}
              urgent={state.remainingSeconds > 0 && state.remainingSeconds <= 10}
            />
            <DisplayStat
              icon={<UserRound size={18} />}
              label="접속"
              value={`${state.connectedCount}/${state.capacity}`}
            />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1.42fr_0.58fr] gap-2.5">
          <section className="min-h-0 rounded-[14px] border border-blue-400/45 bg-[#041127]/82 p-3.5 shadow-[0_0_30px_rgba(37,99,235,0.2)] backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500/15 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.35)]">
                <Activity size={21} />
              </span>
              실시간 기업 가치 그래프
            </h2>

            <div className="mt-2 h-[224px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 6, bottom: 4 }}>
                  <defs>
                    <filter id="displayGlow" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
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
                    width={76}
                    tickFormatter={(value) => formatValue(Number(value))}
                    tick={{ fontSize: 9, fill: "#dbeafe", fontWeight: 700 }}
                    axisLine={{ stroke: "#5b8fe8" }}
                    tickLine={{ stroke: "#5b8fe8" }}
                  />
                  <Tooltip
                    formatter={(value) => formatValue(Number(value))}
                    labelFormatter={(label) => formatChartLabel(String(label))}
                    contentStyle={{
                      background: "rgba(5, 14, 34, 0.94)",
                      border: "1px solid rgba(96,165,250,0.55)",
                      borderRadius: 12,
                      color: "#fff",
                      boxShadow: "0 0 24px rgba(37,99,235,0.35)",
                    }}
                  />
                  {state.companies.map((company) => (
                    <Line
                      key={company.id}
                      type="monotone"
                      dataKey={company.name}
                      stroke={company.color}
                      strokeWidth={3.2}
                      dot={false}
                      activeDot={{ r: 7, strokeWidth: 0 }}
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
      className={`rounded-[14px] border px-4 py-3 shadow-[0_0_24px_rgba(37,99,235,0.18)] backdrop-blur ${
        urgent
          ? "border-red-300/80 bg-red-600/35 text-white"
          : "border-blue-300/50 bg-[#06152f]/82 text-white"
      }`}
    >
      <p className="flex items-center gap-2 text-[13px] font-black text-blue-100">
        <span className={urgent ? "text-red-100" : "text-blue-300"}>{icon}</span>
        {label}
      </p>
      <p className="mt-2 whitespace-nowrap font-mono text-[36px] font-black leading-none tracking-normal text-white drop-shadow-[0_0_18px_rgba(96,165,250,0.45)]">
        {value}
      </p>
    </section>
  );
}

function CompanyTopFive({ companies }: { companies: GameState["companies"] }) {
  return (
    <section className="mt-3 border-t border-blue-300/18 pt-2.5">
      <h3 className="flex items-center gap-1.5 text-lg font-black">
        <span className="text-blue-400">★</span>
        기업 TOP5
      </h3>
      <div className="mt-2.5 grid grid-cols-5 gap-3">
        {companies.map((company) => (
          <article
            key={company.id}
            className="relative min-w-0 overflow-hidden rounded-[10px] border border-blue-300/50 bg-[#06152f]/88 px-3 py-3 text-center shadow-[inset_0_0_20px_rgba(59,130,246,0.1),0_0_20px_rgba(37,99,235,0.16)]"
          >
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: company.color }} />
            <span className="absolute left-1/2 top-1.5 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-blue-600 text-sm font-black shadow-[0_0_16px_rgba(59,130,246,0.8)]">
              {company.rank}
            </span>
            <div className="mt-8 flex justify-center">
              <CompanyAvatar logoUrl={company.logoUrl} color={company.color} name={company.name} compact />
            </div>
            <p className="mt-2 truncate text-sm font-black">{company.name}</p>
            <p className="mt-1 truncate text-[15px] font-black" style={{ color: company.color }}>
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
    <aside className="rounded-[14px] border border-blue-300/50 bg-[#041127]/82 p-3.5 shadow-[0_0_30px_rgba(37,99,235,0.2)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-blue-300/22 pb-3">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Crown className="text-blue-300" size={22} />
          개인 자산 6-10위
        </h2>
        <span className="rounded-full border border-blue-300/35 bg-blue-500/12 px-3 py-1 text-[11px] font-black text-blue-100">
          {state.personalRankingRevealed ? "공개 중" : "공개 전"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {state.personalRankingRevealed
          ? state.participants.slice(5, 10).map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-[10px] border border-blue-300/20 bg-[#071832]/82 px-3 py-3 shadow-[inset_0_0_16px_rgba(59,130,246,0.08)]"
              >
                <span className="font-mono text-2xl font-black text-blue-300">{user.personalRank}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{user.realName}</p>
                  <p className="truncate text-[11px] font-bold text-blue-200/75">{user.companyName}</p>
                </div>
                <span className="text-xs font-black text-white">{formatWon(user.totalAsset)}</span>
              </div>
            ))
          : [6, 7, 8, 9, 10].map((rank) => (
              <div
                key={rank}
                className="grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-[10px] border border-blue-300/20 bg-[#071832]/82 px-3 py-3 shadow-[inset_0_0_16px_rgba(59,130,246,0.08)]"
              >
                <span className="font-mono text-2xl font-black text-blue-300">{rank}</span>
                <span className="h-5 w-20 rounded-full bg-blue-300/10" />
                <span className="flex items-center gap-3 text-xs font-bold text-blue-100">
                  공개 대기
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-blue-300/20 bg-blue-950/60 text-blue-300">
                    <LockKeyhole size={16} />
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
    <footer className="grid shrink-0 gap-2.5 lg:grid-cols-2">
      <InfoTicker
        icon={<Newspaper size={19} />}
        title="최신 뉴스"
        imageUrl={news?.imageUrl}
        headline={news?.title ?? "새 뉴스가 없습니다"}
        body={news?.content ?? "뉴스가 발송되면 이곳에 표시됩니다."}
      />
      <InfoTicker
        icon={<Bell size={19} />}
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
    <section className="rounded-[12px] border border-blue-300/35 bg-[#041127]/86 p-3 shadow-[0_0_24px_rgba(37,99,235,0.16)]">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <span className="text-blue-300">{icon}</span>
        {title}
      </h2>
      <div className="mt-2 flex items-center gap-3 rounded-[10px] border border-blue-300/16 bg-[#071832]/80 p-2">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-11 w-20 shrink-0 rounded-[8px] object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-black text-white">
            i
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{headline}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-blue-100/75">{body}</p>
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
  const sizeClass = compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11";

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
