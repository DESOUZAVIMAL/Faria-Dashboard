import { Routes, Route, Navigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { Login } from "@/components/Login";
import { TodayPage } from "@/pages/TodayPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { WeekPage } from "@/pages/WeekPage";
import { useMe } from "@/lib/queries";
import { AuthError } from "@/lib/api";

export default function App() {
  const { data: me, isLoading, error } = useMe();

  if (isLoading) {
    return (
      <>
        <div className="ts-aurora" />
        <div className="grid min-h-screen place-items-center">
          <div className="ts-pulse font-heading text-lg text-muted-foreground">Loading Ocelli…</div>
        </div>
      </>
    );
  }

  if (error instanceof AuthError || !me) return <Login />;

  return (
    <>
      <div className="ts-aurora" />
      <TopBar />
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/week" element={<WeekPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </>
  );
}
