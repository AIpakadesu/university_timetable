import { useMemo, useState } from "react";
import type { Assignment, Day, TimeBlock } from "../domain/types";
import { useAppStore } from "../domain/store";
import { checkConflictsForPlacement } from "../engine/conflicts";
import { suggestAlternatives } from "../engine/suggest";
import TimetableGrid from "../ui/TimetableGrid";

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

const GRID_CONFIG = { startHour: 9, endHour: 18, slotMinutes: 30 };

export default function PreviewPage() {
  const { input, draftAssignments, placeDraft, removeDraftByOffering, selectedOfferingId } = useAppStore();
  const [profFilter, setProfFilter] = useState<string>("");

  const [inspect, setInspect] = useState<{
    target?: { day: Day; slot: number };
    conflicts: string[];
    alternatives: TimeBlock[];
  }>({ conflicts: [], alternatives: [] });

  const offeringMap = useMemo(() => new Map(input.offerings.map((o) => [o.id, o])), [input.offerings]);

  const shownAssignments = useMemo(() => {
    if (!profFilter) return draftAssignments;
    return draftAssignments.filter((a) => {
      const o = offeringMap.get(a.offeringId);
      return o?.professorId === profFilter;
    });
  }, [draftAssignments, profFilter, offeringMap]);

  // ✅ 충돌 난 과목은 "본인 + 상대방" 둘 다 빨간 표시
  const { redCells, conflictText } = useMemo(() => {
    const red = new Set<string>();
    const msgs: string[] = [];

    const byOfferingId = new Map<string, Assignment>();
    for (const a of draftAssignments) byOfferingId.set(a.offeringId, a);

    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);

      if (conflicts.length > 0) {
        for (let s = a.block.startSlot; s < a.block.startSlot + a.block.slotLength; s++) red.add(`${a.block.day}-${s}`);

        for (const c of conflicts) {
          if (!c.relatedOfferingIds) continue;
          for (const otherId of c.relatedOfferingIds) {
            const other = byOfferingId.get(otherId);
            if (!other) continue;
            for (let s = other.block.startSlot; s < other.block.startSlot + other.block.slotLength; s++) red.add(`${other.block.day}-${s}`);
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

  function inspectPlacement(day: Day, slot: number) {
    if (!selectedOfferingId) {
      setInspect({ target: { day, slot }, conflicts: ["선택된 과목이 없습니다."], alternatives: [] });
      return;
    }

    const off = offeringMap.get(selectedOfferingId);
    if (!off) {
      setInspect({ target: { day, slot }, conflicts: ["선택된 과목 정보를 찾을 수 없습니다."], alternatives: [] });
      return;
    }

    // 평가용 current: 같은 offeringId 배치는 제거(교체 배치 기준)
    const current = draftAssignments.filter((a) => a.offeringId !== selectedOfferingId);

    const test: Assignment = { offeringId: selectedOfferingId, block: { day, startSlot: slot, slotLength: off.slotLength } };
    const conflicts = checkConflictsForPlacement(input, current, test);
    const conflictMsgs = conflicts.map((c) => c.message);

    const alternatives = conflicts.length === 0 ? [] : suggestAlternatives({
      input,
      current,
      offeringId: selectedOfferingId,
      config: GRID_CONFIG,
      max: 3,
    });

    setInspect({ target: { day, slot }, conflicts: conflictMsgs, alternatives });
  }

  function onCellClick(day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) {
    const deleteMode = e.altKey;

    // 클릭한 칸에 걸쳐 있는 배치들
    const hits = draftAssignments.filter(
      (a) => a.block.day === day && overlaps(a.block.startSlot, a.block.slotLength, slot, 1)
    );

    // 항상 “이 위치에 배치하면?”을 먼저 검사해서 오른쪽에 보여주기
    inspectPlacement(day, slot);

    if (deleteMode) {
      if (hits[0]) removeDraftByOffering(hits[0].offeringId);
      return;
    }

    if (!selectedOfferingId) return;

    // 같은 과목이 이미 이 칸에 걸쳐 있으면 클릭으로 삭제(편의)
    const same = hits.find((h) => h.offeringId === selectedOfferingId);
    if (same) {
      removeDraftByOffering(selectedOfferingId);
      return;
    }

    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    placeDraft({
      offeringId: selectedOfferingId,
      block: { day, startSlot: slot, slotLength: off.slotLength },
    });
  }

  function applyAlternative(b: TimeBlock) {
    if (!selectedOfferingId) return;
    placeDraft({ offeringId: selectedOfferingId, block: b });
  }

  const selectedName = selectedOfferingId ? (offeringMap.get(selectedOfferingId)?.courseName ?? selectedOfferingId) : "(없음)";

  return (
    <div style={{ padding: 16 }}>
      <h3>미리보기</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <b>선택 과목:</b>{" "}
          <span style={{ color: selectedOfferingId ? "#111" : "#999" }}>{selectedName}</span>
          <span style={{ opacity: 0.7, marginLeft: 8 }}>※ 클릭: 배치(겹침 허용) / ⌥Option+클릭: 삭제</span>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14, alignItems: "start" }}>
        <TimetableGrid
          input={input}
          config={GRID_CONFIG}
          assignments={shownAssignments}
          redCells={redCells}
          onCellClick={onCellClick}
        />

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <h4 style={{ marginTop: 0 }}>불가 사유 / 대체안</h4>
          <div style={{ opacity: 0.7, marginBottom: 8 }}>
            그리드 셀을 클릭하면 “그 위치에 배치할 때”의 사유와 대체안을 보여줍니다.
          </div>

          {!inspect.target ? (
            <div style={{ opacity: 0.7 }}>아직 선택된 셀이 없습니다.</div>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <b>선택 위치:</b> {inspect.target.day} / 슬롯 {inspect.target.slot}
              </div>

              <div style={{ marginBottom: 10 }}>
                <b>사유:</b>
                <ul>
                  {inspect.conflicts.length === 0 ? (
                    <li style={{ color: "green" }}>배치 가능 ✅</li>
                  ) : (
                    inspect.conflicts.map((m, i) => <li key={i} style={{ color: "#b00" }}>{m}</li>)
                  )}
                </ul>
              </div>

              <div>
                <b>대체 시작시간 추천:</b>
                {inspect.alternatives.length === 0 ? (
                  <div style={{ opacity: 0.7, marginTop: 6 }}>
                    {inspect.conflicts.length === 0 ? "충돌이 없어서 추천이 필요 없습니다." : "추천 가능한 대체 시간이 없습니다."}
                  </div>
                ) : (
                  <ul style={{ marginTop: 6 }}>
                    {inspect.alternatives.map((b, i) => (
                      <li key={i}>
                        <button onClick={() => applyAlternative(b)}>
                          {b.day} / 슬롯 {b.startSlot} (길이 {b.slotLength})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <hr />

          <h4>전체 충돌 요약</h4>
          <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap" }}>
            {conflictText || "현재 충돌 없음 ✅"}
          </pre>
        </div>
      </div>
    </div>
  );
}