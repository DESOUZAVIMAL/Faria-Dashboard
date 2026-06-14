import { Routes, Route, Navigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { TodayPage } from "@/pages/TodayPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { WeekPage } from "@/pages/WeekPage";

export default function App() {
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
