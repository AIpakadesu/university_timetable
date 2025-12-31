import { useMemo, useState } from "react";
import type { Assignment, Day } from "../domain/types";
import { useAppStore } from "../domain/store";
import { checkConflictsForPlacement } from "../engine/conflicts";
import TimetableGrid from "../ui/TimetableGrid";

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

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

  // ✅ 충돌 난 과목은 "본인 + 상대방" 둘 다 빨간 영역 표시
  const { redCells, conflictText } = useMemo(() => {
    const red = new Set<string>();
    const msgs: string[] = [];

    const byOfferingId = new Map<string, Assignment>();
    for (const a of draftAssignments) byOfferingId.set(a.offeringId, a);

    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);

      if (conflicts.length > 0) {
        // 본인 빨간 표시
        for (let s = a.block.startSlot; s < a.block.startSlot + a.block.slotLength; s++) {
          red.add(`${a.block.day}-${s}`);
        }

        // 상대 과목도 함께 빨간 표시(학년/교수 겹침)
        for (const c of conflicts) {
          if (!c.relatedOfferingIds) continue;
          for (const otherId of c.relatedOfferingIds) {
            const other = byOfferingId.get(otherId);
            if (!other) continue;
            for (let s = other.block.startSlot; s < other.block.startSlot + other.block.slotLength; s++) {
              red.add(`${other.block.day}-${s}`);
            }
          }
        }

        const o = offeringMap.get(a.offeringId);
        const title = o ? `${o.courseName}(${o.grade}학년)` : a.offeringId;
        msgs.push(`- ${title}: ${conflicts.map((c) => c.message).join(" / ")}`);
      }

      current.push(a);
    }

    return { redCells: red, conflictText: msgs.join("\n") };
  }, [draftAssignments, input, offeringMap]);

  function onCellClick(day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) {
    // Option(⌥) + 클릭이면 "삭제" 모드
    const deleteMode = e.altKey;

    // 이 칸(시간)에 걸쳐 있는 배치들(겹침 포함)
    const hits = draftAssignments.filter(
      (a) =>
        a.block.day === day &&
        overlaps(a.block.startSlot, a.block.slotLength, slot, 1)
    );

    // 1) 삭제 모드: 가장 먼저 잡힌 과목 하나 삭제(필요하면 나중에 UI로 선택 삭제로 발전)
    if (deleteMode) {
      if (hits[0]) removeDraftByOffering(hits[0].offeringId);
      return;
    }

    // 2) 선택 과목이 없으면 아무 것도 못함(삭제는 Option+클릭)
    if (!selectedOfferingId) return;

    // 3) 같은 과목을 그 칸에 다시 누르면 삭제(편의 기능)
    const same = hits.find((h) => h.offeringId === selectedOfferingId);
    if (same) {
      removeDraftByOffering(selectedOfferingId);
      return;
    }

    // 4) 겹쳐 있어도 배치 허용: 기존 과목은 유지하고 "선택 과목"을 추가 배치
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
          <span style={{ opacity: 0.7, marginLeft: 8 }}>
            ※ 클릭: 배치(겹침 허용) / ⌥Option+클릭: 삭제
          </span>
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