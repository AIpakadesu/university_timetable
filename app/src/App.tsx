import { useEffect } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { useAppStore } from "./domain/store";
import { useAutoSave } from "./domain/useAutoSave";

import PlannerPage from "./pages/PlannerPage";
import WishTimesPage from "./pages/WishTimesPage";
import InitialSetupPage from "./pages/InitialSetupPage";

function TopNav() {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: "8px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: "black",
    background: isActive ? "#e8e8e8" : "transparent",
  });

  return (
    <div style={{ display: "flex", gap: 8, padding: 16, borderBottom: "1px solid #eee" }}>
      {/* ✅ 순서: 플래너 → 희망시간 → 초기설정 */}
      <NavLink to="/" style={linkStyle}>플래너</NavLink>
      <NavLink to="/wish" style={linkStyle}>희망시간</NavLink>
      <NavLink to="/setup" style={linkStyle}>초기 설정</NavLink>
    </div>
  );
}

export default function App() {
  const { loading, init } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  useAutoSave(800);

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;

  return (
    <HashRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<PlannerPage />} />
        <Route path="/wish" element={<WishTimesPage />} />
        <Route path="/setup" element={<InitialSetupPage />} />
      </Routes>
    </HashRouter>
  );
}
