import { useEffect } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { useAppStore } from "./domain/store";
import { useAutoSave } from "./domain/useAutoSave";

import InputPage from "./pages/InputPage";
import ConstraintsPage from "./pages/ConstraintsPage";
import PreviewPage from "./pages/PreviewPage";

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
      <NavLink to="/" style={linkStyle}>
        입력
      </NavLink>
      <NavLink to="/constraints" style={linkStyle}>
        제약조건
      </NavLink>
      <NavLink to="/preview" style={linkStyle}>
        미리보기
      </NavLink>
    </div>
  );
}

export default function App() {
  const { loading, init } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  // ✅ 자동 저장(디바운스)
  useAutoSave(800);

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;

  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/constraints" element={<ConstraintsPage />} />
        <Route path="/preview" element={<PreviewPage />} />
      </Routes>
    </BrowserRouter>
  );
}