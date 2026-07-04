import { io } from "socket.io-client";
import type {
  CompanyId,
  Company,
  GameState,
  GameStatus,
  LoginResponse,
  TransactionLog,
  User,
} from "../types";

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "요청 처리에 실패했습니다." }));
    throw new Error(error.message);
  }

  return response.json() as Promise<T>;
};

export const socket = io(apiUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export const connectRealtime = (userId: string, sessionToken: string) => {
  socket.auth = { userId, sessionToken };
  if (!socket.connected) socket.connect();
};

export const disconnectRealtime = () => {
  socket.auth = {};
  if (socket.connected) socket.disconnect();
};

const adminBody = (adminId: string, payload?: Record<string, unknown>) =>
  JSON.stringify({ adminId, ...payload });

export const api = {
  getState: () => request<GameState>("/api/state"),
  login: (id: string, password: string) =>
    request<LoginResponse>("/api/login", {
      method: "POST",
      body: JSON.stringify({ id, password }),
    }),
  logout: (userId: string, sessionToken: string) =>
    request<GameState>("/api/logout", {
      method: "POST",
      body: JSON.stringify({ userId, sessionToken }),
    }),
  invest: (userId: string, companyId: CompanyId, amount: number) =>
    request<{ log: TransactionLog; state: GameState }>("/api/investments", {
      method: "POST",
      body: JSON.stringify({ userId, companyId, amount }),
    }),
  withdraw: (userId: string, companyId: CompanyId) =>
    request<{ log: TransactionLog; state: GameState }>("/api/withdrawals", {
      method: "POST",
      body: JSON.stringify({ userId, companyId }),
    }),
  setStatus: (adminId: string, status: GameStatus, durationSeconds?: number) =>
    request<GameState>("/api/admin/status", {
      method: "POST",
      body: adminBody(adminId, { status, durationSeconds }),
    }),
  paySalary: (adminId: string) =>
    request<GameState>("/api/admin/pay-salary", {
      method: "POST",
      body: adminBody(adminId),
    }),
  settle: (adminId: string, changes: Partial<Record<CompanyId, number>>) =>
    request<GameState>("/api/admin/settle", {
      method: "POST",
      body: adminBody(adminId, { changes }),
    }),
  advanceYear: (adminId: string) =>
    request<GameState>("/api/admin/advance-year", {
      method: "POST",
      body: adminBody(adminId),
    }),
  retreatYear: (adminId: string) =>
    request<GameState>("/api/admin/retreat-year", {
      method: "POST",
      body: adminBody(adminId),
    }),
  realtimeTick: (adminId: string) =>
    request<GameState>("/api/admin/realtime-tick", {
      method: "POST",
      body: adminBody(adminId),
    }),
  publishNews: (adminId: string, title: string, content: string) =>
    request<GameState>("/api/admin/news", {
      method: "POST",
      body: adminBody(adminId, { title, content }),
    }),
  publishAnnouncement: (adminId: string, content: string) =>
    request<GameState>("/api/admin/announcements", {
      method: "POST",
      body: adminBody(adminId, { content }),
    }),
  updateUser: (
    adminId: string,
    userId: string,
    patch: Partial<Pick<User, "realName" | "companyId" | "rank" | "cash">>,
  ) =>
    request<GameState>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: adminBody(adminId, { patch }),
    }),
  updateCompany: (
    adminId: string,
    companyId: CompanyId,
    patch: Partial<Pick<Company, "name" | "initialCapital" | "currentValue" | "logoUrl" | "tagline">>,
  ) =>
    request<GameState>(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      body: adminBody(adminId, { patch }),
    }),
  reset: (adminId: string, scope = "all") =>
    request<GameState>("/api/admin/reset", {
      method: "POST",
      body: adminBody(adminId, { scope }),
    }),
};
