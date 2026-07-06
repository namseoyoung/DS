import { BarChart3, Clock3, Globe2, LockKeyhole, Megaphone, Trophy } from "lucide-react";
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
      <main className="grid min-h-screen place-items-center bg-[#f3efe7] text-slate-950">
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
    <main className="min-h-screen overflow-x-hidden bg-[#f4efe6] px-5 py-5 text-[#18130b] lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(255,255,255,0.95),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.82),rgba(218,199,164,0.28)_45%,rgba(255,255,255,0.58))]" />
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:linear-gradient(120deg,transparent_0%,transparent_38%,rgba(255,255,255,0.55)_39%,transparent_40%,transparent_100%)]" />

      <section className="relative mx-auto flex h-full max-w-[1540px] flex-col gap-4">
        <header className="grid gap-4 lg:grid-cols-[1fr_590px] lg:items-end">
          <div>
            <p className="text-sm font-black tracking-wide text-[#5f431b]">
              {connected ? "LIVE" : "RECONNECTING"} · {state.year}년차 · {statusLabel[state.status]}
            </p>
            <h1 className="mt-1 text-[clamp(3rem,6vw,5.8rem)] font-black leading-none tracking-normal text-[#18130b] drop-shadow-sm">
              인생여전 <span className="text-[#d6a641]">✦</span>
            </h1>
            <p className="mt-3 text-lg font-semibold text-[#2f281c]">
              지금부터 미래를 바꾸는 투자가 시작됩니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <DisplayStat
              icon={<Clock3 size={52} />}
              label="남은 시간"
              value={formatTimer(state.remainingSeconds)}
              urgent={state.remainingSeconds > 0 && state.remainingSeconds <= 10}
            />
            <DisplayStat
              icon={<Trophy size={56} />}
              label="접속 현황"
              value={`${state.connectedCount} / ${state.capacity}`}
            />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.45fr_0.72fr]">
          <section className="min-h-0 rounded-[22px] border border-[#ddcfb9] bg-white/[0.88] p-7 shadow-[0_20px_60px_rgba(86,62,28,0.18)] backdrop-blur">
            <h2 className="flex items-center gap-3 text-2xl font-black">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fff4d8] text-[#d6a641]">
                <BarChart3 size={26} />
              </span>
              실시간 기업 가치 추이
            </h2>

            <div className="mt-5 h-[300px] xl:h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 34, left: 10, bottom: 6 }}>
                  <CartesianGrid stroke="#e8dfd1" strokeDasharray="4 4" />
                  <XAxis dataKey="label" hide />
                  <YAxis
                    domain={["dataMin - 500", "dataMax + 500"]}
                    width={92}
                    tickFormatter={(value) => formatValue(Number(value))}
                    tick={{ fontSize: 12, fill: "#4b4236", fontWeight: 700 }}
                  />
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
                      dot={{ r: 3 }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
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
      className={`flex min-w-0 items-center gap-5 rounded-[18px] border px-7 py-5 shadow-[0_18px_45px_rgba(86,62,28,0.16)] ${
        urgent ? "border-red-300 bg-red-600 text-white" : "border-[#dfcfb8] bg-white/72 text-[#18130b]"
      }`}
    >
      <div
        className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border ${
          urgent ? "border-white/50 bg-white/15" : "border-[#d6a641] bg-[#fff8e9] text-[#c99526]"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-sm font-black opacity-75">{label}</p>
        <p className="mt-1 whitespace-nowrap font-mono text-4xl font-black leading-none tracking-normal">
          {value}
        </p>
      </div>
    </section>
  );
}

function CompanyTopFive({ companies }: { companies: GameState["companies"] }) {
  return (
    <section className="mt-5">
      <h3 className="text-2xl font-black">기업 TOP5</h3>
      <div className="mt-4 grid grid-cols-5 gap-4">
        {companies.map((company) => (
          <article
            key={company.id}
            className="min-w-0 rounded-[14px] border border-[#d7bf80] bg-gradient-to-br from-white via-[#fffaf0] to-[#efe5d4] p-4 text-center shadow-[0_10px_28px_rgba(88,62,20,0.14)]"
          >
            <p className="text-left text-2xl font-black text-[#c99526]">{company.rank}</p>
            <div className="mt-1 flex justify-center">
              <CompanyAvatar logoUrl={company.logoUrl} color={company.color} name={company.name} compact />
            </div>
            <p className="mt-3 truncate text-lg font-black">{company.name}</p>
            <p className="mt-2 truncate text-xl font-black">{formatValue(company.currentValue)}</p>
            <p className={`mt-2 text-sm font-black ${company.changeRate >= 0 ? "text-red-600" : "text-blue-700"}`}>
              {formatPercent(company.changeRate)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingBoard({ state }: { state: GameState }) {
  return (
    <aside className="rounded-[22px] border border-[#b99752] bg-[#171512] p-7 text-[#f9e2a3] shadow-[0_20px_55px_rgba(42,27,5,0.35)] [background-image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,#23211d,#12110f)]">
      <div className="flex items-center justify-between border-b border-[#d6a641]/25 pb-5">
        <h2 className="text-2xl font-black">개인 자산 6-10위</h2>
        <span className="rounded-full border border-[#b99752] bg-[#4b381c] px-5 py-2 text-sm font-black">
          {state.personalRankingRevealed ? "공개 중" : "공개 전"}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {state.personalRankingRevealed
          ? state.participants.slice(5, 10).map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[52px_1fr_auto] items-center gap-4 rounded-[14px] border border-white/10 bg-black/20 px-5 py-4 text-white"
              >
                <span className="font-serif text-3xl text-[#f9e2a3]">{user.personalRank}</span>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black">{user.realName}</p>
                  <p className="truncate text-sm font-bold text-[#cdb77a]">{user.companyName}</p>
                </div>
                <span className="text-xl font-black">{formatWon(user.totalAsset)}</span>
              </div>
            ))
          : [6, 7, 8, 9, 10].map((rank) => (
              <div
                key={rank}
                className="grid grid-cols-[52px_54px_1fr_auto] items-center gap-4 rounded-[14px] border border-white/10 bg-black/20 px-5 py-4 text-white"
              >
                <span className="font-serif text-3xl text-[#f9e2a3]">{rank}</span>
                <span className="grid h-12 w-12 place-items-center rounded-full border border-[#b99752] text-[#f9e2a3]">
                  <LockKeyhole size={22} />
                </span>
                <span className="text-xl font-black">공개 대기</span>
                <span className="text-xl font-black text-[#f9e2a3]">-</span>
              </div>
            ))}
      </div>

      <div className="mt-5 rounded-[14px] border border-[#b99752] p-5 text-center">
        <p className="text-xl font-black">순위는 추후 공개됩니다.</p>
        <p className="mt-2 text-sm font-bold text-[#e5c875]">모두의 투자가 종료될 때까지 기대해주세요!</p>
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
    <footer className="grid gap-4 rounded-[18px] border border-[#b99752] bg-[#171512] px-7 py-4 text-white shadow-[0_16px_40px_rgba(42,27,5,0.3)] lg:grid-cols-[1fr_1fr]">
      <section className="flex min-w-0 items-center gap-4 border-[#b99752]/40 lg:border-r lg:pr-6">
        {news?.imageUrl ? (
          <img src={news.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#b99752]" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#b99752] text-[#f9e2a3]">
            <Globe2 size={25} />
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xl font-black text-[#f9e2a3]">
            최신 뉴스 <span className="rounded bg-[#b99752] px-2 py-0.5 text-xs text-white">LIVE</span>
          </p>
          <p className="mt-1 truncate text-base font-semibold text-white/80">
            {news ? `${news.title} · ${news.content}` : "새 뉴스가 없습니다."}
          </p>
        </div>
      </section>

      <section className="flex min-w-0 items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#b99752] text-[#f9e2a3]">
          <Megaphone size={25} />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-black text-[#f9e2a3]">최신 공지</p>
          <p className="mt-1 truncate text-base font-semibold text-white/80">
            {announcement ?? "표시할 공지가 없습니다."}
          </p>
        </div>
        <time className="ml-auto hidden shrink-0 text-lg font-bold text-[#f9e2a3] xl:block">
          {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </time>
      </section>
    </footer>
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
  const sizeClass = compact ? "h-14 w-14" : "h-10 w-10 sm:h-11 sm:w-11";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-[#d8c49b]`}
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
