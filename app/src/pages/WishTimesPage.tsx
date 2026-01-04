import { useMemo, useRef, useState } from "react";
import type { Day, TimeBlock, OfferingAvailability } from "../domain/types";
import { useAppStore } from "../domain/store";
import AvailabilityGrid from "../ui/AvailabilityGrid";
import UnavailabilityGrid from "../ui/UnavailabilityGrid";

const GRID_CONFIG = { startHour: 9, endHour: 22, slotMinutes: 60 };

const DAYS: { key: Day; label: string }[] = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
];

const dayOrder: Record<Day, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 };

function slotToTime(startHour: number, slot: number) {
  const h = startHour + slot;
  return `${String(h).padStart(2, "0")}:00`;
}

function formatBlock(startHour: number, b: TimeBlock) {
  const d = DAYS.find((x) => x.key === b.day)?.label ?? b.day;
  const s = slotToTime(startHour, b.startSlot);
  const e = slotToTime(startHour, b.startSlot + b.slotLength);
  return `${d} ${s}~${e} (${b.slotLength}시간)`;
}

function sortBlocks(a: TimeBlock, b: TimeBlock) {
  const da = dayOrder[a.day] ?? 99;
  const db = dayOrder[b.day] ?? 99;
  if (da !== db) return da - db;
  return a.startSlot - b.startSlot;
}

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

function formatLunchSummary(lunchRules: TimeBlock[], startHour: number) {
  if (!lunchRules || lunchRules.length === 0) return "설정 없음";
  const same = lunchRules.every(
    (r) => r.startSlot === lunchRules[0].startSlot && r.slotLength === lunchRules[0].slotLength
  );
  if (same && lunchRules.length >= 3) {
    const s = slotToTime(startHour, lunchRules[0].startSlot);
    const e = slotToTime(startHour, lunchRules[0].startSlot + lunchRules[0].slotLength);
    return `월~금 ${s}~${e}`;
  }
  return lunchRules
    .slice()
    .sort(sortBlocks)
    .map((r) => formatBlock(startHour, r))
    .join(" · ");
}

export default function WishTimesPage() {
  const { input, setInput, maxGrade } = useAppStore();
  const inputAny = input as any;

  const [mode, setMode] = useState<"COURSE" | "PROF">("COURSE");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("");

  // 토스트 (안정화)
  const [toast, setToast] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2400);
  }

  // hover 미리보기 시작점
  const [hoverStart, setHoverStart] = useState<{ day: Day; slot: number } | null>(null);

  const offering = useMemo(() => {
    return input.offerings.find((o) => o.id === selectedOfferingId);
  }, [input.offerings, selectedOfferingId]);

  // 점심시간 규칙
  const lunchRules: TimeBlock[] = useMemo(() => {
    return (inputAny?.lunchRules ?? []) as TimeBlock[];
  }, [inputAny]);

  const lunchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of lunchRules) {
      for (let t = b.startSlot; t < b.startSlot + b.slotLength; t++) {
        s.add(`${b.day}-${t}`);
      }
    }
    return s;
  }, [lunchRules]);

  const lunchSummary = useMemo(() => formatLunchSummary(lunchRules, GRID_CONFIG.startHour), [lunchRules]);

  // 과목별 희망시간 저장값
  const currentAllowedBlocks = useMemo<TimeBlock[]>(() => {
    if (!selectedOfferingId) return [];
    return input.availability.find((a) => a.offeringId === selectedOfferingId)?.allowedBlocks ?? [];
  }, [input.availability, selectedOfferingId]);

  const allowedStartsSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of currentAllowedBlocks) s.add(`${b.day}-${b.startSlot}`);
    return s;
  }, [currentAllowedBlocks]);

  function upsertAvailability(offeringId: string, allowedBlocks: TimeBlock[]) {
    const others = input.availability.filter((a) => a.offeringId !== offeringId);
    const row: OfferingAvailability = { offeringId, allowedBlocks };
    setInput({ availability: [...others, row] });
  }

  // “침범 가능 시작점” 표시용
  const warnStarts = useMemo(() => {
    const s = new Set<string>();
    if (!offering) return s;

    const slotsPerHour = 60 / GRID_CONFIG.slotMinutes;
    const totalSlots = (GRID_CONFIG.endHour - GRID_CONFIG.startHour) * slotsPerHour;

    const nationalGrades: number[] =
      inputAny?.nationalProgramGrades ?? inputAny?.nationalGrades ?? [];
    const isNational = Array.isArray(nationalGrades) && nationalGrades.includes(offering.grade);

    const afternoonStartHour = inputAny?.nationalAfternoonStartHour ?? 13;
    const afternoonStartSlot = Math.max(0, afternoonStartHour - GRID_CONFIG.startHour);

    for (const d of DAYS) {
      for (let startSlot = 0; startSlot < totalSlots; startSlot++) {
        const end = startSlot + offering.slotLength;

        const lunchToday = lunchRules.filter((r) => r.day === d.key);
        const hitsLunch = lunchToday.some((r) =>
          overlaps(startSlot, offering.slotLength, r.startSlot, r.slotLength)
        );

        const hitsNational = isNational && end > afternoonStartSlot;

        if (hitsLunch || hitsNational) s.add(`${d.key}-${startSlot}`);
      }
    }
    return s;
  }, [offering, lunchRules, inputAny]);

  function toggleAllowed(day: Day, startSlot: number) {
    if (!offering) return;

    const block: TimeBlock = { day, startSlot, slotLength: offering.slotLength };

    // 점심 침범 경고(막지 않음)
    const lunchToday = lunchRules.filter((r) => r.day === day);
    const hitLunch = lunchToday.find((r) =>
      overlaps(block.startSlot, block.slotLength, r.startSlot, r.slotLength)
    );
    if (hitLunch) {
      const clsS = slotToTime(GRID_CONFIG.startHour, block.startSlot);
      const clsE = slotToTime(GRID_CONFIG.startHour, block.startSlot + block.slotLength);
      const lS = slotToTime(GRID_CONFIG.startHour, hitLunch.startSlot);
      const lE = slotToTime(GRID_CONFIG.startHour, hitLunch.startSlot + hitLunch.slotLength);
      showToast(`⚠️ 점심시간(${lS}~${lE})을 침범합니다: 수업 ${clsS}~${clsE}`);
    }

    // 국비 오후 경고(막지 않음)
    const nationalGrades: number[] =
      inputAny?.nationalProgramGrades ?? inputAny?.nationalGrades ?? [];
    const isNational = Array.isArray(nationalGrades) && nationalGrades.includes(offering.grade);
    if (isNational) {
      const afternoonStartHour = inputAny?.nationalAfternoonStartHour ?? 13;
      const afternoonStartSlot = Math.max(0, afternoonStartHour - GRID_CONFIG.startHour);
      if (block.startSlot + block.slotLength > afternoonStartSlot) {
        const clsS = slotToTime(GRID_CONFIG.startHour, block.startSlot);
        const clsE = slotToTime(GRID_CONFIG.startHour, block.startSlot + block.slotLength);
        showToast(`⚠️ 국비교육 학년 오후 제한에 걸릴 수 있습니다: ${clsS}~${clsE}`);
      }
    }

    // 토글 저장
    const next = [...currentAllowedBlocks];
    const idx = next.findIndex(
      (b) => b.day === day && b.startSlot === startSlot && b.slotLength === offering.slotLength
    );

    if (idx >= 0) next.splice(idx, 1);
    else next.push(block);

    upsertAvailability(offering.id, next);
  }

  // hoverStart가 있으면 그 시간부터 시수만큼 “연파랑 미리보기”
  const previewBlock = useMemo(() => {
    if (!offering || !hoverStart) return null;
    return { day: hoverStart.day, startSlot: hoverStart.slot, slotLength: offering.slotLength } as TimeBlock;
  }, [offering, hoverStart]);

  const sortedAllowedBlocks = useMemo(() => [...currentAllowedBlocks].sort(sortBlocks), [currentAllowedBlocks]);
  const totalWishHours = useMemo(
    () => sortedAllowedBlocks.reduce((sum, b) => sum + b.slotLength, 0),
    [sortedAllowedBlocks]
  );

  // 교수별 불가시간(기존 유지)
  const profBlocks = useMemo<TimeBlock[]>(() => {
    if (!selectedProfessorId) return [];
    return input.professorUnavailableRules.find((r) => r.professorId === selectedProfessorId)?.blocks ?? [];
  }, [input.professorUnavailableRules, selectedProfessorId]);

  const blockedSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of profBlocks) s.add(`${b.day}-${b.startSlot}`);
    return s;
  }, [profBlocks]);

  function upsertProfBlocks(professorId: string, blocks: TimeBlock[]) {
    const others = input.professorUnavailableRules.filter((r) => r.professorId !== professorId);
    setInput({ professorUnavailableRules: [...others, { professorId, blocks }] });
  }

  function toggleProfBlocked(day: Day, startSlot: number) {
    if (!selectedProfessorId) return;

    const key = `${day}-${startSlot}`;
    const next = [...profBlocks];
    const idx = next.findIndex((b) => `${b.day}-${b.startSlot}` === key);

    if (idx >= 0) next.splice(idx, 1);
    else next.push({ day, startSlot, slotLength: 1 });

    upsertProfBlocks(selectedProfessorId, next);
  }

  const totalProfBlockedHours = useMemo(
    () => profBlocks.reduce((sum, b) => sum + b.slotLength, 0),
    [profBlocks]
  );

  return (
    <div style={{ padding: 16, position: "relative" }}>
      {/* 토스트 */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #eee",
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 9999,
            fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>희망시간</h3>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          점심시간: <b>{lunchSummary}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <b>보기:</b>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: 6 }}>
          <option value="COURSE">과목별</option>
          <option value="PROF">교수별</option>
        </select>

        <span style={{ opacity: 0.72 }}>
          (연노랑=점심시간, 파랑=선택 범위, 연파랑=미리보기, ●=시작점, ⚠=침범 가능 시작점)
        </span>

        {mode === "COURSE" && offering && (
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65 }}>
            hover: {hoverStart ? `${hoverStart.day} ${slotToTime(GRID_CONFIG.startHour, hoverStart.slot)}` : "-"}
          </span>
        )}
      </div>

      {mode === "COURSE" ? (
        <section>
          <h4>과목별 희망시간</h4>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <b>과목:</b>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              style={{ padding: 6, minWidth: 320 }}
            >
              <option value="">(선택)</option>
              {input.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.courseName} / {o.grade}학년 / {o.slotLength}시간
                </option>
              ))}
            </select>

            {offering && (
              <>
                <span style={{ opacity: 0.85 }}>
                  선택 과목 시수: <b>{offering.slotLength}시간</b>
                </span>
                <button onClick={() => upsertAvailability(offering.id, [])}>희망시간 초기화</button>
              </>
            )}
          </div>

          {!offering ? (
            <div style={{ opacity: 0.7 }}>과목을 선택하면 그리드가 나타납니다.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h4 style={{ marginTop: 6 }}>{offering.grade}학년 그리드</h4>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  총 선택 시수: <b>{totalWishHours}시간</b>{" "}
                  <span style={{ opacity: 0.75 }}>(= {offering.slotLength}시간 × {sortedAllowedBlocks.length}개)</span>
                </div>
              </div>

              <AvailabilityGrid
                config={GRID_CONFIG}
                selectedBlocks={currentAllowedBlocks}
                allowedStarts={allowedStartsSet}
                markedCells={lunchCellSet}
                markedCellLabel="점심시간"
                warnStarts={warnStarts}
                previewBlock={previewBlock}
                onHoverStart={(day, slotOrNull) => {
                  if (slotOrNull === null) setHoverStart(null);
                  else setHoverStart({ day, slot: slotOrNull });
                }}
                onToggle={toggleAllowed}
              />

              <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10, background: "#fafafa" }}>
                <b>현재 선택된 희망시간(시간 범위)</b>
                {sortedAllowedBlocks.length === 0 ? (
                  <div style={{ opacity: 0.7, marginTop: 6 }}>아직 선택된 시간이 없습니다.</div>
                ) : (
                  <ul style={{ marginTop: 8 }}>
                    {sortedAllowedBlocks.map((b, i) => (
                      <li key={i}>{formatBlock(GRID_CONFIG.startHour, b)}</li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.72 }}>
                  ※ 점심시간을 침범해도 “희망시간 기록”은 가능하지만, 경고가 뜹니다.
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <section>
          <h4>교수별 불가시간(1시간 단위)</h4>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <b>교수:</b>
            <select
              value={selectedProfessorId}
              onChange={(e) => setSelectedProfessorId(e.target.value)}
              style={{ padding: 6, minWidth: 260 }}
            >
              <option value="">(선택)</option>
              {input.professors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <span style={{ opacity: 0.75 }}>
              총 불가시간: <b>{totalProfBlockedHours}시간</b>
            </span>
          </div>

          {!selectedProfessorId ? (
            <div style={{ opacity: 0.7 }}>교수를 선택하면 전체 학년 그리드를 띄웁니다.</div>
          ) : (
            <>
              {Array.from({ length: maxGrade }, (_, i) => i + 1).map((g) => (
                <div key={g} style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: "6px 0" }}>{g}학년 그리드(전체 학년 표시)</h4>
                  <UnavailabilityGrid config={GRID_CONFIG} blocked={blockedSet} onToggle={toggleProfBlocked} />
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}