import { useEffect } from "react";
import { useAppStore } from "./domain/store";

export default function App() {
  const { loading, init, input, setInput, saveAll } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>University Timetable (MVP)</h2>

      <button
        onClick={async () => {
          await saveAll();
          alert("저장 완료!");
        }}
      >
        수동 저장(테스트)
      </button>

      <hr />

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
        새로고침해도 교수 수가 유지되면 IndexedDB 자동저장 준비가 잘 된 겁니다.
      </p>
    </div>
  );
}