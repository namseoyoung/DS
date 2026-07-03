import { AdminPage } from "./pages/AdminPage";
import { DisplayPage } from "./pages/DisplayPage";
import { ParticipantPage } from "./pages/ParticipantPage";
import { useGameState } from "./hooks/useGameState";

export default function App() {
  const { state, setState, isConnected, error } = useGameState();
  const path = window.location.pathname;

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center text-slate-950">
        <div>
          <h1 className="text-2xl font-bold">서버에 연결할 수 없습니다</h1>
          <p className="mt-3 text-slate-500">{error}</p>
        </div>
      </main>
    );
  }

  if (path.startsWith("/admin")) {
    return <AdminPage state={state} setState={setState} connected={isConnected} />;
  }

  if (path.startsWith("/display")) {
    return <DisplayPage state={state} connected={isConnected} />;
  }

  return <ParticipantPage state={state} setState={setState} connected={isConnected} />;
}
