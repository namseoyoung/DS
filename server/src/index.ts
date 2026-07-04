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

const activeSessions = new Map<string, ActiveSession>();
const LOGIN_GRACE_MS = 15000;

const getActiveParticipantCount = () =>
  [...activeSessions.values()].filter(
    (session) => session.role === "participant" && session.sockets.size > 0,
  ).length;

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

    const existingSession = activeSessions.get(id);
    if (existingSession && (existingSession.sockets.size > 0 || Date.now() - existingSession.createdAt < LOGIN_GRACE_MS)) {
      response.status(409).json({ message: "이미 다른 화면에서 로그인 중입니다. 먼저 로그아웃해 주세요." });
      return;
    }

    const user = await store.login(id, password);
    const sessionToken = crypto.randomUUID();
    activeSessions.set(user.id, {
      token: sessionToken,
      userId: user.id,
      role: user.role,
      sockets: new Set(),
      createdAt: Date.now(),
    });
    const state = await broadcastState();
    response.json({ user, state, sessionToken });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", async (request, response, next) => {
  try {
    const userId = String(request.body.userId ?? "");
    const sessionToken = String(request.body.sessionToken ?? "");
    const session = activeSessions.get(userId);
    if (session && session.token === sessionToken) {
      activeSessions.delete(userId);
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.userId === userId) socket.disconnect(true);
      }
    }
    if (userId) await store.setOnline(userId, false);
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

app.post("/api/withdrawals", async (request, response, next) => {
  try {
    const userId = String(request.body.userId ?? "");
    const companyId = String(request.body.companyId ?? "") as CompanyId;

    const log = await store.withdraw(userId, companyId);
    const state = await broadcastState();
    io.emit("transaction:created", log);
    response.status(201).json({ log, state });
  } catch (error) {
    next(error);
  }
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
      store.publishNews(String(request.body.title ?? ""), String(request.body.content ?? "")),
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
  const session = activeSessions.get(userId);
  if (!userId || !sessionToken || !session || session.token !== sessionToken) {
    next(new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요."));
    return;
  }
  socket.data.userId = userId;
  next();
});

io.on("connection", async (socket) => {
  const userId = String(socket.data.userId);
  const session = activeSessions.get(userId);
  if (session) {
    session.sockets.add(socket.id);
    await store.setOnline(userId, true);
  }
  io.emit("game:state", await withConnectedCount());

  socket.on("disconnect", () => {
    const currentSession = activeSessions.get(userId);
    if (currentSession) {
      currentSession.sockets.delete(socket.id);
      if (currentSession.sockets.size === 0) {
        activeSessions.delete(userId);
        void store.setOnline(userId, false).then(() => broadcastState());
        return;
      }
    }
    void broadcastState();
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
