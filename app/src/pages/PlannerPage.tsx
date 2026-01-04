import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Assignment, Day, TimeBlock, Conflict } from "../domain/types";
import { useAppStore } from "../domain/store";
import TimetableGrid from "../ui/TimetableGrid";
import { checkConflictsForPlacement } from "../engine/conflicts";
import { suggestAlternatives } from "../engine/suggest";

const GRID_CONFIG = { startHour: 9, endHour: 18, slotMinutes: 60 };

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

// ✅ 여기 걸리면 "배치 자체"를 막습니다(점심/국비/교양/교수불가/희망시간대 위반)
function hasHardConflict(conflicts: Conflict[]) {
  return conflicts.some(
    (c) =>
      c.code === "LUNCH_BLOCKED" ||
      c.code === "OFFERING_UNAVAILABLE" ||
      c.code === "GRADE_AFTERNOON_BLOCKED" ||
      c.code === "MAJOR_BLOCKED_FOR_LIBERAL_DAY" ||
      c.code === "PROF_UNAVAILABLE"
  );
}

export default function PlannerPage() {
  const {
    input,
    maxGrade,
    draftAssignments,
    placeDraft,
    removeDraftByOffering,
    selectedOfferingId,
    setSelectedOfferingId,
  } = useAppStore();

  // ✅ 점심시간(초기설정) 표시를 플래너 그리드에도 적용하기 위해 lunchRules → cellSet으로 변환
  const inputAny = input as any;
  const lunchRules = (inputAny?.lunchRules ?? []) as TimeBlock[];

  const lunchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of lunchRules) {
      for (let t = b.startSlot; t < b.startSlot + b.slotLength; t++) {
        s.add(`${b.day}-${t}`);
      }
    }
    return s;
  }, [lunchRules]);

  const [inspect, setInspect] = useState<{
    target?: { grade: number; day: Day; slot: number };
    conflicts: string[];
    alternatives: TimeBlock[];
  }>({ conflicts: [], alternatives: [] });

  const offeringMap = useMemo(
    () => new Map(input.offerings.map((o) => [o.id, o])),
    [input.offerings]
  );
  const profMap = useMemo(
    () => new Map(input.professors.map((p) => [p.id, p])),
    [input.professors]
  );

  const selectedOffering = selectedOfferingId
    ? offeringMap.get(selectedOfferingId)
    : undefined;

  // ✅ 학년별 빨간 셀(충돌 표시)
  const redCellsByGrade = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (let g = 1; g <= maxGrade; g++) m.set(g, new Set());

    const byOfferingId = new Map<string, Assignment>();
    for (const a of draftAssignments) byOfferingId.set(a.offeringId, a);

    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);

      if (conflicts.length > 0) {
        const off = offeringMap.get(a.offeringId);
        const g = off?.grade;

        if (g && m.has(g)) {
          for (let s = a.block.startSlot; s < a.block.startSlot + a.block.slotLength; s++) {
            m.get(g)!.add(`${a.block.day}-${s}`);
          }
        }

        for (const c of conflicts) {
          if (!c.relatedOfferingIds) continue;
          for (const otherId of c.relatedOfferingIds) {
            const other = byOfferingId.get(otherId);
            const otherOff = offeringMap.get(otherId);
            const og = otherOff?.grade;
            if (!other || !og || !m.has(og)) continue;
            for (let s = other.block.startSlot; s < other.block.startSlot + other.block.slotLength; s++) {
              m.get(og)!.add(`${other.block.day}-${s}`);
            }
          }
        }
      }

      current.push(a);
    }

    return m;
  }, [draftAssignments, input, offeringMap, maxGrade]);

  function inspectPlacement(grade: number, day: Day, slot: number) {
    if (!selectedOfferingId) {
      setInspect({
        target: { grade, day, slot },
        conflicts: ["선택된 과목이 없습니다."],
        alternatives: [],
      });
      return;
    }

    const off = offeringMap.get(selectedOfferingId);
    if (!off) {
      setInspect({
        target: { grade, day, slot },
        conflicts: ["선택 과목 정보를 찾을 수 없습니다."],
        alternatives: [],
      });
      return;
    }

    // ✅ 다른 학년 그리드에 배치 금지
    if (off.grade !== grade) {
      setInspect({
        target: { grade, day, slot },
        conflicts: [`선택 과목은 ${off.grade}학년입니다. ${grade}학년 그리드에는 배치할 수 없습니다.`],
        alternatives: [],
      });
      return;
    }

    const current = draftAssignments.filter((a) => a.offeringId !== selectedOfferingId);
    const test: Assignment = {
      offeringId: selectedOfferingId,
      block: { day, startSlot: slot, slotLength: off.slotLength },
    };

    const conflicts = checkConflictsForPlacement(input, current, test);
    const conflictMsgs = conflicts.map((c) => c.message);

    const alternatives =
      conflicts.length === 0
        ? []
        : suggestAlternatives({
            input,
            current,
            offeringId: selectedOfferingId,
            config: GRID_CONFIG,
            max: 3,
          });

    setInspect({ target: { grade, day, slot }, conflicts: conflictMsgs, alternatives });
  }

  function tryPlace(grade: number, day: Day, slot: number) {
    if (!selectedOfferingId) return;

    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    // ✅ 다른 학년 그리드 금지
    if (off.grade !== grade) return;

    const current = draftAssignments.filter((a) => a.offeringId !== selectedOfferingId);
    const next: Assignment = {
      offeringId: selectedOfferingId,
      block: { day, startSlot: slot, slotLength: off.slotLength },
    };

    const conflicts = checkConflictsForPlacement(input, current, next);

    // ✅ 하드 제약이면 배치 금지
    if (hasHardConflict(conflicts)) {
      setInspect({
        target: { grade, day, slot },
        conflicts: conflicts.map((c) => c.message),
        alternatives: suggestAlternatives({
          input,
          current,
          offeringId: selectedOfferingId,
          config: GRID_CONFIG,
          max: 3,
        }),
      });
      return;
    }

    // ✅ 겹침(학년/교수 충돌)은 배치 허용 + 빨강으로 표시
    placeDraft(next);
  }

  function onCellClickWithGrade(
    grade: number,
    day: Day,
    slot: number,
    e: MouseEvent<HTMLTableCellElement>
  ) {
    const deleteMode = e.altKey;

    const hits = draftAssignments.filter((a) => {
      const o = offeringMap.get(a.offeringId);
      if (!o || o.grade !== grade) return false;
      return a.block.day === day && overlaps(a.block.startSlot, a.block.slotLength, slot, 1);
    });

    inspectPlacement(grade, day, slot);

    if (deleteMode) {
      if (hits[0]) removeDraftByOffering(hits[0].offeringId);
      return;
    }

    if (!selectedOfferingId) return;

    // 같은 과목을 클릭한 경우 토글 삭제
    const same = hits.find((h) => h.offeringId === selectedOfferingId);
    if (same) {
      removeDraftByOffering(selectedOfferingId);
      return;
    }

    tryPlace(grade, day, slot);
  }

  function applyAlternative(b: TimeBlock) {
    if (!selectedOfferingId) return;
    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    const grade = off.grade;
    const current = draftAssignments.filter((a) => a.offeringId !== selectedOfferingId);
    const next: Assignment = { offeringId: selectedOfferingId, block: b };
    const conflicts = checkConflictsForPlacement(input, current, next);

    if (hasHardConflict(conflicts)) {
      setInspect({
        target: { grade, day: b.day, slot: b.startSlot },
        conflicts: conflicts.map((c) => c.message),
        alternatives: [],
      });
      return;
    }

    placeDraft(next);
  }

  const [gradeFilter, setGradeFilter] = useState<number>(1);
  const gradeOptions = Array.from({ length: maxGrade }, (_, i) => i + 1);

  const filteredOfferings = useMemo(() => {
    return input.offerings.filter((o) => o.grade === gradeFilter);
  }, [input.offerings, gradeFilter]);

  return (
    <div style={{ padding: 16 }}>
      <h3>플래너</h3>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b>작업 학년:</b>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(Number(e.target.value))} style={{ padding: 6 }}>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}학년
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b>배치할 과목:</b>
          <select
            value={selectedOfferingId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedOfferingId(id);
              const o = offeringMap.get(id);
              if (o) setGradeFilter(o.grade);
            }}
            style={{ padding: 6, minWidth: 320 }}
          >
            <option value="">(선택 안 함)</option>
            {filteredOfferings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.courseName} / {o.grade}학년 / {profMap.get(o.professorId)?.name ?? "교수?"}
              </option>
            ))}
          </select>
        </div>

        <span style={{ opacity: 0.7 }}>클릭: 배치 / ⌥Option+클릭: 삭제</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {gradeOptions.map((g) => {
            const gradeAssignments = draftAssignments.filter((a) => offeringMap.get(a.offeringId)?.grade === g);
            const redCells = redCellsByGrade.get(g) ?? new Set<string>();

            // ✅ 선택 과목이 있을 때, 학년이 다른 그리드는 비활성 처리
            const isDisabledGrid = !!selectedOffering && selectedOffering.grade !== g;

            return (
              <div key={g}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h4 style={{ margin: "6px 0", opacity: isDisabledGrid ? 0.65 : 1 }}>
                    {g}학년 시간표
                  </h4>

                  {isDisabledGrid && selectedOffering && (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      선택 과목: {selectedOffering.grade}학년 → 이 그리드는 배치 불가
                    </span>
                  )}
                </div>

                <TimetableGrid
                  input={input}
                  config={GRID_CONFIG}
                  assignments={gradeAssignments}
                  redCells={redCells}
                  // ✅ 점심시간 셀 표시 (TimetableGrid가 이 props를 받아야 함)
                  markedCells={lunchCellSet}
                  markedCellLabel="점심시간"
                  // ✅ 다른 학년 그리드는 비활성 UI
                  disabled={isDisabledGrid}
                  onCellClick={(day, slot, e) => onCellClickWithGrade(g, day, slot, e)}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 12,
            position: "sticky",
            top: 12,
            height: "fit-content",
          }}
        >
          <h4 style={{ marginTop: 0 }}>불가 사유 / 대체안</h4>

          {!inspect.target ? (
            <div style={{ opacity: 0.7 }}>그리드 셀을 클릭하면 사유/대체안이 뜹니다.</div>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <b>선택 위치:</b> {inspect.target.grade}학년 / {inspect.target.day} / 슬롯 {inspect.target.slot}
              </div>

              <div style={{ marginBottom: 10 }}>
                <b>사유:</b>
                <ul>
                  {inspect.conflicts.length === 0 ? (
                    <li style={{ color: "green" }}>배치 가능 ✅</li>
                  ) : (
                    inspect.conflicts.map((m, i) => (
                      <li key={i} style={{ color: "#b00" }}>
                        {m}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                <b>대체 시작시간 추천:</b>
                {inspect.alternatives.length === 0 ? (
                  <div style={{ opacity: 0.7, marginTop: 6 }}>추천 가능한 대체 시간이 없습니다.</div>
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
        </div>
      </div>
    </div>
  );
}