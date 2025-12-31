import { useEffect } from "react";
import { useAppStore } from "./domain/store";
import { useAutoSave } from "./domain/useAutoSave";

export default function App() {
  const { loading, init, input, setInput } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  // ✅ 자동 저장(디바운스)
  useAutoSave(800);

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>University Timetable (MVP)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <b>교수 수:</b> {input.professors.length}
        <button
          onClick={() => {
            const id = `p_${Math.random().toString(36).slice(2, 8)}`;
            setInput({
              professors: [...input.professors, { id, name: `교수${input.professors.length + 1}` }],
            });
          }}
        >
          교수 추가(테스트)
        </button>
      </div>

      <p style={{ opacity: 0.7 }}>
        교수 추가 후 1초 정도 기다렸다가 새로고침해도 유지되면 “자동저장” 성공입니다.
      </p>
    </div>
  );
}