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

export default function PlannerPage() {
  const {
    input,
    setInput,
    draftAssignments,
    placeDraft,
    removeDraftByOffering,
    selectedOfferingId,
    setSelectedOfferingId,
  } = useAppStore();

  const [profFilter, setProfFilter] = useState<string>("");

  const [inspect, setInspect] = useState<{
    target?: { day: Day; slot: number };
    conflicts: string[];
    alternatives: TimeBlock[];
  }>({ conflicts: [], alternatives: [] });

  const offeringMap = useMemo(() => new Map(input.offerings.map((o) => [o.id, o])), [input.offerings]);
  const profMap = useMemo(() => new Map(input.professors.map((p) => [p.id, p])), [input.professors]);

  const shownAssignments = useMemo(() => {
    if (!profFilter) return draftAssignments;
    return draftAssignments.filter((a) => {
      const o = offeringMap.get(a.offeringId);
      return o?.professorId === profFilter;
    });
  }, [draftAssignments, profFilter, offeringMap]);

  // 충돌 표시(빨간 셀) + 요약
  const { redCells, conflictText } = useMemo(() => {
    const red = new Set<string>();
    const msgs: string[] = [];

    const byOfferingId = new Map<string, Assignment>();
    for (const a of draftAssignments) byOfferingId.set(a.offeringId, a);

    const current: Assignment[] = [];
    for (const a of draftAssignments) {
      const conflicts = checkConflictsForPlacement(input, current, a);

      if (conflicts.length > 0) {
        for (let s = a.block.startSlot; s < a.block.startSlot + a.block.slotLength; s++) {
          red.add(`${a.block.day}-${s}`);
        }

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

    setInspect({ target: { day, slot }, conflicts: conflictMsgs, alternatives });
  }

  function onCellClick(day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) {
    const deleteMode = e.altKey;

    const hits = draftAssignments.filter(
      (a) => a.block.day === day && overlaps(a.block.startSlot, a.block.slotLength, slot, 1)
    );

    inspectPlacement(day, slot);

    if (deleteMode) {
      if (hits[0]) removeDraftByOffering(hits[0].offeringId);
      return;
    }

    if (!selectedOfferingId) return;

    const same = hits.find((h) => h.offeringId === selectedOfferingId);
    if (same) {
      removeDraftByOffering(selectedOfferingId);
      return;
    }

    const off = offeringMap.get(selectedOfferingId);
    if (!off) return;

    placeDraft({ offeringId: selectedOfferingId, block: { day, startSlot: slot, slotLength: off.slotLength } });
  }

  function applyAlternative(b: TimeBlock) {
    if (!selectedOfferingId) return;
    placeDraft({ offeringId: selectedOfferingId, block: b });
  }

  const selectedName =
    selectedOfferingId ? (offeringMap.get(selectedOfferingId)?.courseName ?? selectedOfferingId) : "(없음)";

  return (
    <div style={{ padding: 16 }}>
      <h3>플래너(입력 + 배치 통합)</h3>

      {/* 상단: 입력/선택 영역 */}
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
              grade: 1,
              majorType: "MAJOR" as const,
              professorId,
              slotLength: 3, // ✅ 1시간 단위 기준: 기본 3시간
              mustBeConsecutive: true,
            };

            setInput({ offerings: [...input.offerings, next] });
            setSelectedOfferingId(id);
          }}
        >
          과목 추가
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b>배치할 과목:</b>
          <select value={selectedOfferingId} onChange={(e) => setSelectedOfferingId(e.target.value)} style={{ padding: 6, minWidth: 240 }}>
            <option value="">(선택 안 함)</option>
            {input.offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.courseName} / {o.grade}학년 / {profMap.get(o.professorId)?.name ?? "교수?"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <b>교수별 보기:</b>
          <select value={profFilter} onChange={(e) => setProfFilter(e.target.value)} style={{ padding: 6 }}>
            <option value="">(전체)</option>
            {input.professors.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ opacity: 0.7, marginBottom: 10 }}>
        클릭: 배치(겹침 허용) / ⌥Option+클릭: 삭제 / 오른쪽에 불가 사유 + 대체안 표시됨
      </div>

      {/* 본문: 그리드 + 패널 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <div>
          <TimetableGrid
            input={input}
            config={GRID_CONFIG}
            assignments={shownAssignments}
            redCells={redCells}
            onCellClick={onCellClick}
          />

          <div style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 6 }}>과목 목록(간단 편집)</h4>
            <ul>
              {input.offerings.map((o) => (
                <li key={o.id}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <b>{o.courseName}</b>
                    <span style={{ opacity: 0.6 }}>{o.id}</span>

                    <label>
                      학년:
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={o.grade}
                        onChange={(e) => {
                          const grade = Number(e.target.value);
                          setInput({ offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, grade } : x)) });
                        }}
                        style={{ width: 60, marginLeft: 6 }}
                      />
                    </label>

                    <label>
                      전공/교양:
                      <select
                        value={o.majorType}
                        onChange={(e) => {
                          const majorType = e.target.value as "MAJOR" | "LIBERAL";
                          setInput({ offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, majorType } : x)) });
                        }}
                        style={{ marginLeft: 6 }}
                      >
                        <option value="MAJOR">전공</option>
                        <option value="LIBERAL">교양</option>
                      </select>
                    </label>

                    <label>
                      담당교수:
                      <select
                        value={o.professorId}
                        onChange={(e) => {
                          const professorId = e.target.value;
                          setInput({ offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, professorId } : x)) });
                        }}
                        style={{ marginLeft: 6 }}
                      >
                        {input.professors.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      시수(시간):
                      <select
                        value={o.slotLength}
                        onChange={(e) => {
                          const slotLength = Number(e.target.value);
                          setInput({ offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, slotLength } : x)) });
                        }}
                        style={{ marginLeft: 6 }}
                      >
                        <option value={2}>2시간</option>
                        <option value={3}>3시간</option>
                        <option value={4}>4시간</option>
                      </select>
                    </label>

                    <button
                      onClick={() => {
                        setInput({ offerings: input.offerings.filter((x) => x.id !== o.id) });
                        if (selectedOfferingId === o.id) setSelectedOfferingId("");
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <h4 style={{ marginTop: 0 }}>불가 사유 / 대체안</h4>

          <div style={{ marginBottom: 8 }}>
            <b>선택 과목:</b> <span style={{ color: selectedOfferingId ? "#111" : "#999" }}>{selectedName}</span>
          </div>

          {!inspect.target ? (
            <div style={{ opacity: 0.7 }}>그리드에서 셀을 클릭하면 사유/대체안이 뜹니다.</div>
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