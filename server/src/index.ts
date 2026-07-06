import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { CompanyId, GameStatus } from "../../src/types";
import { isInvestableStatus } from "./seed";
import { createStore } from "./store";

const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientOrigin, methods: ["GET", "POST"] },
});
const store = createStore();

type ActiveSession = {
  token: string;
  userId: string;
  role: "participant" | "admin";
  sockets: Set<string>;
  createdAt: number;
};

const activeSessionsByToken = new Map<string, ActiveSession>();
const participantSessionByUser = new Map<string, string>();
const LOGIN_GRACE_MS = 15000;

const getActiveParticipantCount = () =>
  [...activeSessionsByToken.values()].filter(
    (session) => session.role === "participant" && session.sockets.size > 0,
  ).length;

const hasActiveSessionForUser = (userId: string) =>
  [...activeSessionsByToken.values()].some(
    (session) => session.userId === userId && session.sockets.size > 0,
  );

const endParticipantSession = (userId: string) => {
  const existingToken = participantSessionByUser.get(userId);
  if (!existingToken) return;

  activeSessionsByToken.delete(existingToken);
  participantSessionByUser.delete(userId);
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.sessionToken === existingToken) socket.disconnect(true);
  }
};

const createSession = (userId: string, role: "participant" | "admin") => {
  if (role === "participant") {
    endParticipantSession(userId);
  }

  const sessionToken = crypto.randomUUID();
  activeSessionsByToken.set(sessionToken, {
    token: sessionToken,
    userId,
    role,
    sockets: new Set(),
    createdAt: Date.now(),
  });
  if (role === "participant") {
    participantSessionByUser.set(userId, sessionToken);
  }
  return sessionToken;
};

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

const withConnectedCount = async () => {
  const state = await store.getState();
  return { ...state, connectedCount: getActiveParticipantCount() };
};

const broadcastState = async () => {
  const state = await withConnectedCount();
  io.emit("game:state", state);
  return state;
};

const requireAdmin = async (adminId: unknown) => {
  const state = await store.getState();
  const admin = state.users.find((user) => user.id === adminId && user.role === "admin");
  if (!admin) {
    const error = new Error("관리자 인증이 필요합니다.");
    error.name = "Unauthorized";
    throw error;
  }
};

const runAdminAction = async (
  request: express.Request,
  response: express.Response,
  action: () => Promise<void>,
) => {
  await requireAdmin(request.body.adminId);
  await action();
  response.json(await broadcastState());
};

app.get("/health", (_request, response) => response.json({ ok: true }));

app.get("/api/state", async (_request, response, next) => {
  try {
    response.json(await withConnectedCount());
  } catch (error) {
    next(error);
  }
});

app.post("/api/login", async (request, response, next) => {
  try {
    const id = String(request.body.id ?? "").trim();
    const password = String(request.body.password ?? "").trim();
    if (!id || !password) {
      response.status(400).json({ message: "아이디와 비밀번호를 입력해 주세요." });
      return;
    }

    const user = await store.login(id, password);
    const existingToken = participantSessionByUser.get(user.id);
    const existingSession = existingToken ? activeSessionsByToken.get(existingToken) : undefined;
    if (user.role === "participant" && existingSession && (existingSession.sockets.size > 0 || Date.now() - existingSession.createdAt < LOGIN_GRACE_MS)) {
      endParticipantSession(user.id);
    }

    const sessionToken = createSession(user.id, user.role);
    const state = await broadcastState();
    response.json({ user, state, sessionToken });
  } catch (error) {
    next(error);
  }
});


app.post("/api/session/restore", async (request, response, next) => {
  try {
    const userId = String(request.body.userId ?? "");
    const previousToken = String(request.body.sessionToken ?? "");
    if (!userId || !previousToken) {
      response.status(401).json({ message: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요." });
      return;
    }

    const state = await store.getState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      response.status(401).json({ message: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요." });
      return;
    }

    const existingSession = activeSessionsByToken.get(previousToken);
    if (existingSession && existingSession.userId === user.id) {
      response.json({ user, state: await withConnectedCount(), sessionToken: previousToken });
      return;
    }

    const sessionToken = createSession(user.id, user.role);
    await store.setOnline(user.id, false);
    response.json({ user, state: await broadcastState(), sessionToken });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", async (request, response, next) => {
  try {
    const userId = String(request.body.userId ?? "");
    const sessionToken = String(request.body.sessionToken ?? "");
    const session = activeSessionsByToken.get(sessionToken);
    if (session && session.userId === userId) {
      activeSessionsByToken.delete(sessionToken);
      if (session.role === "participant") {
        participantSessionByUser.delete(userId);
      }
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.sessionToken === sessionToken) socket.disconnect(true);
      }
    }
    if (userId && !hasActiveSessionForUser(userId)) await store.setOnline(userId, false);
    response.json(await broadcastState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/investments", async (request, response, next) => {
  try {
    const userId = String(request.body.userId ?? "");
    const companyId = String(request.body.companyId ?? "") as CompanyId;
    const amount = Math.floor(Number(request.body.amount));

    const log = await store.invest(userId, companyId, amount);
    const state = await broadcastState();
    io.emit("transaction:created", log);
    response.status(201).json({ log, state });
  } catch (error) {
    next(error);
  }
});

app.post("/api/withdrawals", (_request, response) => {
  response.status(403).json({ message: "투자금 회수는 관리자 전체 회수로만 진행할 수 있습니다." });
});

app.post("/api/admin/status", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () =>
      store.setStatus(request.body.status as GameStatus, Number(request.body.durationSeconds ?? 0)),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/pay-salary", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.paySalary());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/settle", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.settleYear(request.body.changes ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/withdraw-all", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.withdrawAllRoundInvestments());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/advance-round", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.advanceRound());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/start-round", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.startRound(Number(request.body.round)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/settle-round", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.settleRound());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/advance-year", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.advanceYear());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/retreat-year", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.retreatYear());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/realtime-tick", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.realtimeTick());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/news", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () =>
      store.publishNews(
        String(request.body.title ?? ""),
        String(request.body.content ?? ""),
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/announcements", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () =>
      store.publishAnnouncement(String(request.body.content ?? "")),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/personal-ranking", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () =>
      store.setPersonalRankingRevealed(Boolean(request.body.revealed)),
    );
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:userId", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.updateUser(request.params.userId, request.body.patch ?? {}));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/companies/:companyId", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () =>
      store.updateCompany(request.params.companyId as CompanyId, request.body.patch ?? {}),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/reset", async (request, response, next) => {
  try {
    await runAdminAction(request, response, () => store.reset(String(request.body.scope ?? "all")));
  } catch (error) {
    next(error);
  }
});

io.use((socket, next) => {
  const userId = String(socket.handshake.auth.userId ?? "");
  const sessionToken = String(socket.handshake.auth.sessionToken ?? "");
  const session = activeSessionsByToken.get(sessionToken);
  if (!userId || !sessionToken || !session || session.userId !== userId) {
    next(new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요."));
    return;
  }
  socket.data.userId = userId;
  socket.data.sessionToken = sessionToken;
  next();
});

io.on("connection", async (socket) => {
  const userId = String(socket.data.userId);
  const sessionToken = String(socket.data.sessionToken);
  const session = activeSessionsByToken.get(sessionToken);
  if (session) {
    session.sockets.add(socket.id);
    await store.setOnline(userId, true);
  }
  io.emit("game:state", await withConnectedCount());

  socket.on("disconnect", () => {
    const currentSession = activeSessionsByToken.get(sessionToken);
    if (currentSession) {
      currentSession.sockets.delete(socket.id);
    }
    void store.setOnline(userId, hasActiveSessionForUser(userId)).then(() => broadcastState());
  });
});

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    response.status(error.name === "Unauthorized" ? 401 : 400).json({ message: error.message });
  },
);

await store.initialize();

const timerGuards = new Map<
  string,
  { sent60: boolean; sent30: boolean; closed: boolean }
>();
setInterval(async () => {
  try {
    const state = await store.getState();

    if (!state.timerEndsAt) return;

    const guard = timerGuards.get(state.timerEndsAt) ?? {
      sent60: false,
      sent30: false,
      closed: false,
    };
    timerGuards.set(state.timerEndsAt, guard);

    if (isInvestableStatus(state.status) && state.remainingSeconds <= 60 && state.remainingSeconds > 30 && !guard.sent60) {
      guard.sent60 = true;
      await store.publishAnnouncement("투자가 1분 후 마감됩니다!");
      await broadcastState();
    }

    if (isInvestableStatus(state.status) && state.remainingSeconds <= 30 && state.remainingSeconds > 0 && !guard.sent30) {
      guard.sent30 = true;
      await store.publishAnnouncement("투자가 30초 후 마감됩니다!");
      await broadcastState();
    }

    if (state.remainingSeconds <= 0 && !guard.closed) {
      guard.closed = true;
      if (state.status === "ROUND_INVESTING") {
        await store.publishAnnouncement(`${state.currentRound}라운드 투자 결과가 공개되었습니다.`);
        await store.realtimeTick();
        await store.setStatus("ROUND_RESULT", 20);
      } else if (state.status === "ROUND_RESULT") {
        await store.withdrawAllRoundInvestments();
        await store.publishAnnouncement(`${state.currentRound}라운드 투자금이 전액 회수되었습니다.`);
        await store.advanceRound();
      } else if (isInvestableStatus(state.status)) {
        await store.publishAnnouncement("투자가 종료되었습니다.");
        await store.setStatus("INVEST_CLOSED");
        await store.settleYear({});
        if (state.year === 4) {
          await store.setStatus("FINISHED");
        }
      }
      await broadcastState();
    }
  } catch (error) {
    console.error("Timer automation failed", error);
  }
}, 1000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Investment simulation API listening on ${port}`);
});
