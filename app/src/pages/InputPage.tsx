import { useAppStore } from "../domain/store";

export default function InputPage() {
  const { input, setInput } = useAppStore();

  return (
    <div style={{ padding: 16 }}>
      <h3>입력</h3>

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
          교수 추가
        </button>
      </div>

      <hr />

      <div>
        <b>교수 목록</b>
        <ul>
          {input.professors.map((p) => (
            <li key={p.id}>
              {p.name} <span style={{ opacity: 0.6 }}>({p.id})</span>
            </li>
          ))}
        </ul>
      </div>

      <p style={{ opacity: 0.7 }}>
        다음 스텝에서 과목/학년/희망시간 입력 UI를 붙일 겁니다.
      </p>
    </div>
  );
}