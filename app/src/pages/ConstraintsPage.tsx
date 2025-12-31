import { useAppStore } from "../domain/store";

export default function ConstraintsPage() {
  const { input, setInput } = useAppStore();

  return (
    <div style={{ padding: 16 }}>
      <h3>제약조건</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <b>국비교육(오후 불가) 학년 규칙:</b> {input.govtTrainingRules.length}개
        <button
          onClick={() => {
            // 예: 2학년 오후불가(13:00 시작을 startSlot=8로 가정)
            setInput({
              govtTrainingRules: [...input.govtTrainingRules, { grade: 2, afternoonStartSlot: 8 }],
            });
          }}
        >
          예시 규칙 추가
        </button>
        <button onClick={() => setInput({ govtTrainingRules: [] })}>초기화</button>
      </div>

      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
        {JSON.stringify(input.govtTrainingRules, null, 2)}
      </pre>

      <hr />

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <b>교양으로 인한 전공 배치 불가(예시):</b> {input.majorBlockedRules.length}개
        <button
          onClick={() => {
            setInput({
              majorBlockedRules: [...input.majorBlockedRules, { day: "WED", startSlot: 0, slotLength: 18 }],
            });
          }}
        >
          예시 규칙 추가
        </button>
        <button onClick={() => setInput({ majorBlockedRules: [] })}>초기화</button>
      </div>

      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
        {JSON.stringify(input.majorBlockedRules, null, 2)}
      </pre>

      <p style={{ opacity: 0.7 }}>
        다음 스텝에서 “캘린더 그리드”로 클릭해서 제약을 지정하게 만들 겁니다.
      </p>
    </div>
  );
}