import { useMemo, useState } from "react";
import type { Assignment, Day } from "../domain/types";
import { useAppStore } from "../domain/store";
import { checkConflictsForPlacement } from "../engine/conflicts";
import TimetableGrid from "../ui/TimetableGrid";

export default function PreviewPage() {
  const { input, draftAssignments, placeDraft, removeDraftByOffering, selectedOfferingId } = useAppStore();
  const [profFilter, setProfFilter] = useState<string>("");

  const offeringMap = useMemo(() => new Map(input.offerings.map((o) => [o.id, o])), [input.offerings]);

  const shownAssignments = useMemo(() => {
    if (!profFilter) return draftAssignments;
    return draftAssignments.filter((a) => {
      const o = offeringMap.get(a.offeringId);
      return o?.professorId === profFilter;
    });
  }, [draftAssignments, profFilter, offeringMap]);

  const { redCells, conflictText } = useMemo(() => {
    const red = new Set<string>();
    const msgs: string[] = [];

    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);

      if (conflicts.length > 0) {
        for (let s = a.block.startSlot; s < a.block.startSlot + a.block.slotLength; s++) {
          red.add(`${a.block.day}-${s}`);
        }
        const o = offeringMap.get(a.offeringId);
        const title = o ? `${o.courseName}(${o.grade}학년)` : a.offeringId;
        msgs.push(`- ${title}: ${conflicts.map((c) => c.message).join(" / ")}`);
      }

      current.push(a);
    }

    return { redCells: red, conflictText: msgs.join("\n") };
  }, [draftAssignments, input, offeringMap]);

  function onCellClick(day: Day, slot: number) {
    const hit = draftAssignments.find(
      (a) => a.block.day === day && slot >= a.block.startSlot && slot < a.block.startSlot + a.block.slotLength
    );
    if (hit) {
      removeDraftByOffering(hit.offeringId);
      return;
    }

    if (!selectedOfferingId) return;

    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    placeDraft({
      offeringId: selectedOfferingId,
      block: { day, startSlot: slot, slotLength: off.slotLength },
    });
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>미리보기</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <b>선택 과목:</b>{" "}
          <span style={{ color: selectedOfferingId ? "#111" : "#999" }}>
            {selectedOfferingId ? offeringMap.get(selectedOfferingId)?.courseName ?? selectedOfferingId : "(없음)"}
          </span>
          <span style={{ opacity: 0.7, marginLeft: 8 }}>※ 빈 칸 클릭 = 배치 / 배치된 칸 클릭 = 삭제</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <b>교수별 보기:</b>
          <select value={profFilter} onChange={(e) => setProfFilter(e.target.value)} style={{ padding: 6 }}>
            <option value="">(전체)</option>
            {input.professors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TimetableGrid
        input={input}
        config={{ startHour: 9, endHour: 18, slotMinutes: 30 }}
        assignments={shownAssignments}
        redCells={redCells}
        onCellClick={onCellClick}
      />

      <div style={{ marginTop: 14 }}>
        <h4 style={{ marginBottom: 6 }}>충돌/불가 사유(요약)</h4>
        <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
          {conflictText || "현재 충돌 없음 ✅"}
        </pre>
      </div>
    </div>
  );
}
