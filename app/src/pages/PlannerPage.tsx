import { useMemo, useState } from "react";
import type { Assignment, Day, TimeBlock } from "../domain/types";
import { useAppStore } from "../domain/store";
import TimetableGrid from "../ui/TimetableGrid";
import { checkConflictsForPlacement } from "../engine/conflicts";
import { suggestAlternatives } from "../engine/suggest";

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

const GRID_CONFIG = { startHour: 9, endHour: 18, slotMinutes: 60 };

function clamp(n: number, min: number, max: number) {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export default function PlannerPage() {
  const {
    input,
    setInput,
    draftAssignments,
    placeDraft,
    removeDraftByOffering,
    selectedOfferingId,
    setSelectedOfferingId,
    maxGrade,
    setMaxGrade,
  } = useAppStore();

  const [inspect, setInspect] = useState<{
    target?: { grade: number; day: Day; slot: number };
    conflicts: string[];
    alternatives: TimeBlock[];
  }>({ conflicts: [], alternatives: [] });

  const offeringMap = useMemo(() => new Map(input.offerings.map((o) => [o.id, o])), [input.offerings]);
  const profMap = useMemo(() => new Map(input.professors.map((p) => [p.id, p])), [input.professors]);

  const selectedOffering = selectedOfferingId ? offeringMap.get(selectedOfferingId) : undefined;

  // ✅ 학년별 빨간 셀(충돌 표시) 만들기
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

        // 관련 과목도 빨간 표시(동일 교수/동일 학년 충돌)
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

  // 충돌 텍스트 요약(전체)
  const conflictText = useMemo(() => {
    const msgs: string[] = [];
    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);
      if (conflicts.length > 0) {
        const o = offeringMap.get(a.offeringId);
        const title = o ? `${o.courseName}(${o.grade}학년)` : a.offeringId;
        msgs.push(`- ${title}: ${conflicts.map((c) => c.message).join(" / ")}`);
      }
      current.push(a);
    }
    return msgs.join("\n");
  }, [draftAssignments, input, offeringMap]);

  function inspectPlacement(grade: number, day: Day, slot: number) {
    if (!selectedOfferingId) {
      setInspect({ target: { grade, day, slot }, conflicts: ["선택된 과목이 없습니다."], alternatives: [] });
      return;
    }

    const off = offeringMap.get(selectedOfferingId);
    if (!off) {
      setInspect({ target: { grade, day, slot }, conflicts: ["선택 과목 정보를 찾을 수 없습니다."], alternatives: [] });
      return;
    }

    // ✅ 학년이 다른 그리드에 클릭하면 배치 막기(혼동 방지)
    if (off.grade !== grade) {
      setInspect({
        target: { grade, day, slot },
        conflicts: [`선택 과목은 ${off.grade}학년입니다. ${grade}학년 그리드에는 배치할 수 없습니다.`],
        alternatives: [],
      });
      return;
    }

    const current = draftAssignments.filter((a) => a.offeringId !== selectedOfferingId);
    const test: Assignment = { offeringId: selectedOfferingId, block: { day, startSlot: slot, slotLength: off.slotLength } };

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

  function onCellClickWithGrade(grade: number, day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) {
    const deleteMode = e.altKey;

    // 그 학년의 배치만 히트 대상으로(혼동 방지)
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

    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    // ✅ 학년 다른 곳에는 배치 금지
    if (off.grade !== grade) return;

    // 같은 과목이 이미 걸쳐 있으면 클릭으로 삭제(편의)
    const same = hits.find((h) => h.offeringId === selectedOfferingId);
    if (same) {
      removeDraftByOffering(selectedOfferingId);
      return;
    }

    placeDraft({ offeringId: selectedOfferingId, block: { day, startSlot: slot, slotLength: off.slotLength } });
  }

  function applyAlternative(b: TimeBlock) {
    if (!selectedOfferingId) return;
    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;
    placeDraft({ offeringId: selectedOfferingId, block: b });
  }

  // ✅ 현재 학년 필터(드롭다운에서만 사용)
  const [gradeFilter, setGradeFilter] = useState<number>(1);
  const gradeOptions = Array.from({ length: maxGrade }, (_, i) => i + 1);

  const filteredOfferings = useMemo(() => {
    return input.offerings.filter((o) => o.grade === gradeFilter);
  }, [input.offerings, gradeFilter]);

  return (
    <div style={{ padding: 16 }}>
      <h3>플래너</h3>

      {/* 초기 설정: 총 학년 수 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <b>총 학년 수(초기 설정):</b>
        <input
          type="number"
          min={1}
          max={8}
          value={maxGrade}
          onChange={(e) => setMaxGrade(clamp(Number(e.target.value), 1, 8))}
          style={{ width: 80, padding: 6 }}
        />
        <span style={{ opacity: 0.7 }}>현재 1~{maxGrade}학년 그리드를 출력합니다.</span>
      </div>

      {/* 상단: 입력/선택 */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <button
          onClick={() => {
            const id = `p_${Math.random().toString(36).slice(2, 8)}`;
            setInput({ professors: [...input.professors, { id, name: `교수${input.professors.length + 1}` }] });
          }}
        >
          교수 추가
        </button>

        <button
          disabled={input.professors.length === 0}
          onClick={() => {
            if (input.professors.length === 0) return;
            const id = `o_${Math.random().toString(36).slice(2, 8)}`;
            const professorId = input.professors[0].id;

            const next = {
              id,
              courseName: `과목${input.offerings.length + 1}`,
              grade: clamp(gradeFilter, 1, maxGrade), // ✅ 현재 필터 학년으로 생성
              majorType: "MAJOR" as const,
              professorId,
              slotLength: 3, // 1시간 단위 기준 기본 3시간
              mustBeConsecutive: true,
            };

            setInput({ offerings: [...input.offerings, next] });
            setSelectedOfferingId(id);
          }}
        >
          과목 추가
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b>작업 학년:</b>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(Number(e.target.value))} style={{ padding: 6 }}>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}학년</option>
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
              if (o) setGradeFilter(o.grade); // ✅ 선택하면 자동으로 그 학년으로 맞춰줌
            }}
            style={{ padding: 6, minWidth: 280 }}
          >
            <option value="">(선택 안 함)</option>
            {filteredOfferings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.courseName} / {o.grade}학년 / {profMap.get(o.professorId)?.name ?? "교수?"}
              </option>
            ))}
          </select>
          <span style={{ opacity: 0.7 }}>
            {selectedOffering ? `선택: ${selectedOffering.grade}학년` : ""}
          </span>
        </div>
      </div>

      <div style={{ opacity: 0.7, marginBottom: 10 }}>
        클릭: 배치 / ⌥Option+클릭: 삭제 / 학년이 다른 그리드에는 배치가 막힙니다.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        {/* 왼쪽: 학년별 그리드 출력 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {gradeOptions.map((g) => {
            const gradeAssignments = draftAssignments.filter((a) => offeringMap.get(a.offeringId)?.grade === g);
            const redCells = redCellsByGrade.get(g) ?? new Set<string>();

            return (
              <div key={g}>
                <h4 style={{ margin: "6px 0" }}>{g}학년 시간표</h4>
                <TimetableGrid
                  input={input}
                  config={GRID_CONFIG}
                  assignments={gradeAssignments}
                  redCells={redCells}
                  onCellClick={(day, slot, e) => onCellClickWithGrade(g, day, slot, e)}
                />
              </div>
            );
          })}
        </div>

        {/* 오른쪽: 사유/대체안 패널 */}
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, position: "sticky", top: 12, height: "fit-content" }}>
          <h4 style={{ marginTop: 0 }}>불가 사유 / 대체안</h4>

          <div style={{ marginBottom: 8 }}>
            <b>선택 과목:</b>{" "}
            <span style={{ color: selectedOfferingId ? "#111" : "#999" }}>
              {selectedOffering ? `${selectedOffering.courseName} (${selectedOffering.grade}학년)` : "(없음)"}
            </span>
          </div>

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
                      <li key={i} style={{ color: "#b00" }}>{m}</li>
                    ))
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
