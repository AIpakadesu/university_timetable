import { useMemo } from "react";
import { useAppStore } from "../domain/store";
import type { Assignment } from "../domain/types";
import { validateAllAssignments } from "../engine/conflicts";

export default function PreviewPage() {
  const { input } = useAppStore();

  // 아직 배치 생성기가 없으니, "테스트용 배치"를 임시로 하나 만들어 충돌 검사만 보여줌
  const demoAssignments: Assignment[] = useMemo(() => {
    if (input.offerings.length === 0) return [];
    const first = input.offerings[0];
    return [{ offeringId: first.id, block: { day: "MON", startSlot: 8, slotLength: first.slotLength } }];
  }, [input.offerings]);

  const conflicts = useMemo(() => validateAllAssignments(input, demoAssignments), [input, demoAssignments]);

  return (
    <div style={{ padding: 16 }}>
      <h3>미리보기</h3>

      <p style={{ opacity: 0.7 }}>
        지금은 “배치 결과”가 아직 없어서, 충돌 검증 로직 연결만 확인하는 화면입니다.
        다음 스텝에서 시간표 그리드 + 빨간 겹침 표시로 바꿉니다.
      </p>

      <div>
        <b>충돌/불가 사유:</b> {conflicts.length}개
        <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
          {JSON.stringify(conflicts, null, 2)}
        </pre>
      </div>
    </div>
  );
}