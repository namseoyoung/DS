import { useEffect, useState } from "react";
import { api, connectRealtime, socket } from "../lib/api";
import { authStorage } from "../lib/authStorage";
import type { GameState } from "../types";

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getState().then(setState).catch((caught: Error) => setError(caught.message));

    const savedUserId = authStorage.get("sessionUserId");
    const savedToken = authStorage.get("sessionToken");
    if (savedUserId && savedToken) {
      connectRealtime(savedUserId, savedToken);
    }

    const handleState = (nextState: GameState) => {
      setState(nextState);
      setError(null);
    };
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = (caught: Error) => {
      setIsConnected(false);
      setError(caught.message);
      if (caught.message.includes("세션") || caught.message.includes("로그인")) {
        const savedUserId = authStorage.get("sessionUserId");
        const savedToken = authStorage.get("sessionToken");
        if (!savedUserId || !savedToken) return;

        api
          .restoreSession(savedUserId, savedToken)
          .then((response) => {
            authStorage.set("sessionUserId", response.user.id);
            authStorage.set("sessionToken", response.sessionToken);
            if (response.user.role === "admin") authStorage.set("adminId", response.user.id);
            else authStorage.set("userId", response.user.id);
            setState(response.state);
            connectRealtime(response.user.id, response.sessionToken);
          })
          .catch(() => authStorage.clear());
      }
    };

    socket.on("game:state", handleState);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("game:state", handleState);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  return { state, setState, isConnected, error };
}
