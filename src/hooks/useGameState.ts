import { useEffect, useState } from "react";
import { api, socket } from "../lib/api";
import type { GameState } from "../types";

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getState().then(setState).catch((caught: Error) => setError(caught.message));

    const handleState = (nextState: GameState) => {
      setState(nextState);
      setError(null);
    };
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("game:state", handleState);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("game:state", handleState);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  return { state, setState, isConnected, error };
}
