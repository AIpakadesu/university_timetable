import { useMemo, useState } from "react";
import type { Day, TimeBlock, OfferingAvailability } from "../domain/types";
import { useAppStore } from "../domain/store";
import AvailabilityGrid from "../ui/AvailabilityGrid";
import UnavailabilityGrid from "../ui/UnavailabilityGrid";

// ✅ 16:00 이후 선택 가능하도록 그리드 시간 확장
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

// ✅ 점심시간 요약
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

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

export default function WishTimesPage() {
  const { input, setInput, maxGrade } = useAppStore();
  const inputAny = input as any;

  const [mode, setMode] = useState<"COURSE" | "PROF">("COURSE");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("");

  const offering = useMemo(() => {
    return input.offerings.find((o) => o.id === selectedOfferingId);
  }, [input.offerings, selectedOfferingId]);

  // ✅ 점심시간 규칙
  const lunchRules: TimeBlock[] = useMemo(() => {
    return (inputAny?.lunchRules ?? []) as TimeBlock[];
  }, [inputAny]);

  // ✅ 점심시간 셀 표시(연노랑)
  const lunchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of lunchRules) {
      for (let t = b.startSlot; t < b.startSlot + b.slotLength; t++) {
        s.add(`${b.day}-${t}`);
      }
    }
    return s;
  }, [lunchRules]);

  const lunchSummary = useMemo(
    () => formatLunchSummary(lunchRules, GRID_CONFIG.startHour),
    [lunchRules]
  );

  // ===== 과목별 희망시간 =====
  const slotsPerHour = 60 / GRID_CONFIG.slotMinutes;
  const totalSlots = (GRID_CONFIG.endHour - GRID_CONFIG.startHour) * slotsPerHour;

  const currentAllowedBlocks = useMemo<TimeBlock[]>(() => {
    if (!selectedOfferingId) return [];
    return input.availability.find((a) => a.offeringId === selectedOfferingId)?.allowedBlocks ?? [];
  }, [input.availability, selectedOfferingId]);

  const allowedStartsSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of currentAllowedBlocks) s.add(`${b.day}-${b.startSlot}`);
    return s;
  }, [currentAllowedBlocks]);

  // ✅ “선택 불가 시작점”을 점심/국비만으로 만들되,
  //    왜 막히는지(특히 3시간 과목이면 10~12도 막히는 이유)까지 툴팁 제공
  const { disabledStartsSet, disabledReasonByStart } = useMemo(() => {
    const disabled = new Set<string>();
    const reason = new Map<string, string>();

    if (!offering) return { disabledStartsSet: disabled, disabledReasonByStart: reason };

    // 국비 학년 목록/오후 시작시각
    const nationalGrades: number[] =
      inputAny?.nationalProgramGrades ?? inputAny?.nationalGrades ?? [];
    const isNational = Array.isArray(nationalGrades) && nationalGrades.includes(offering.grade);
    const afternoonStartHour = inputAny?.nationalAfternoonStartHour ?? 13;
    const afternoonStartSlot = Math.max(0, afternoonStartHour - GRID_CONFIG.startHour);

    for (const d of DAYS) {
      for (let startSlot = 0; startSlot < totalSlots; startSlot++) {
        const key = `${d.key}-${startSlot}`;
        const endSlot = startSlot + offering.slotLength;

        // 1) 점심시간과 “수업 범위”가 겹치면 시작점 금지
        const lunchToday = lunchRules.filter((r) => r.day === d.key);
        for (const r of lunchToday) {
          if (overlaps(startSlot, offering.slotLength, r.startSlot, r.slotLength)) {
            disabled.add(key);

            const clsS = slotToTime(GRID_CONFIG.startHour, startSlot);
            const clsE = slotToTime(GRID_CONFIG.startHour, endSlot);
            const lunchS = slotToTime(GRID_CONFIG.startHour, r.startSlot);
            const lunchE = slotToTime(GRID_CONFIG.startHour, r.startSlot + r.slotLength);

            reason.set(
              key,
              `선택 불가: ${offering.slotLength}시간 수업(${clsS}~${clsE})이 점심시간(${lunchS}~${lunchE})과 겹칩니다.`
            );
            break;
          }
        }

        // 2) 국비 학년이면 오후 포함 시작점 금지(점심보다 우선 설명)
        if (isNational) {
          const touchesAfternoon = endSlot > afternoonStartSlot && startSlot < totalSlots;
          if (touchesAfternoon) {
            disabled.add(key);

            const clsS = slotToTime(GRID_CONFIG.startHour, startSlot);
            const clsE = slotToTime(GRID_CONFIG.startHour, endSlot);
            const aft = slotToTime(GRID_CONFIG.startHour, afternoonStartSlot);

            reason.set(
              key,
              `선택 불가: 국비교육 학년은 ${aft} 이후 수업이 제한됩니다. (${clsS}~${clsE} 포함)`
            );
          }
        }
      }
    }

    return { disabledStartsSet: disabled, disabledReasonByStart: reason };
  }, [offering, lunchRules, inputAny, totalSlots]);

  function upsertAvailability(offeringId: string, allowedBlocks: TimeBlock[]) {
    const others = input.availability.filter((a) => a.offeringId !== offeringId);
    const row: OfferingAvailability = { offeringId, allowedBlocks };
    setInput({ availability: [...others, row] });
  }

  function toggleAllowed(day: Day, startSlot: number) {
    if (!offering) return;

    const key = `${day}-${startSlot}`;
    if (disabledStartsSet.has(key)) return;

    const next = [...currentAllowedBlocks];
    const idx = next.findIndex(
      (b) => b.day === day && b.startSlot === startSlot && b.slotLength === offering.slotLength
    );

    if (idx >= 0) next.splice(idx, 1);
    else next.push({ day, startSlot, slotLength: offering.slotLength });

    upsertAvailability(offering.id, next);
  }

  const sortedAllowedBlocks = useMemo(() => {
    return [...currentAllowedBlocks].sort(sortBlocks);
  }, [currentAllowedBlocks]);

  const totalWishHours = useMemo(() => {
    return sortedAllowedBlocks.reduce((sum, b) => sum + b.slotLength, 0);
  }, [sortedAllowedBlocks]);

  // ===== 교수별 불가시간 =====
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

  const sortedProfBlocks = useMemo(() => {
    return [...profBlocks].sort(sortBlocks);
  }, [profBlocks]);

  const totalProfBlockedHours = useMemo(() => {
    return sortedProfBlocks.reduce((sum, b) => sum + b.slotLength, 0);
  }, [sortedProfBlocks]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>희망시간</h3>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          점심시간: <b>{lunchSummary}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <b>보기:</b>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: 6 }}>
          <option value="COURSE">과목별</option>
          <option value="PROF">교수별</option>
        </select>

        <span style={{ opacity: 0.7 }}>
          (연노랑=점심시간, 연파랑=희망시간 범위, ●=시작점, ×=제약으로 시작 불가)
        </span>
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
              <span style={{ opacity: 0.8 }}>
                선택 과목 시수: <b>{offering.slotLength}시간</b>
              </span>
            )}
          </div>

          {!offering ? (
            <div style={{ opacity: 0.7 }}>과목을 선택하면 그리드가 나타납니다.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h4 style={{ marginTop: 6 }}>{offering.grade}학년 그리드</h4>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  총 선택 시수: <b>{totalWishHours}시간</b>{" "}
                  <span style={{ opacity: 0.75 }}>(= {offering.slotLength}시간 × {sortedAllowedBlocks.length}개)</span>
                </div>
              </div>

              <AvailabilityGrid
                config={GRID_CONFIG}
                selectedBlocks={currentAllowedBlocks}
                allowedStarts={allowedStartsSet}
                disabledStarts={disabledStartsSet}
                disabledReasonByStart={disabledReasonByStart}
                markedCells={lunchCellSet}
                markedCellLabel="점심시간"
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

              <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10, background: "#fafafa" }}>
                <b>현재 선택된 교수 불가시간(시간 범위)</b>
                {sortedProfBlocks.length === 0 ? (
                  <div style={{ opacity: 0.7, marginTop: 6 }}>아직 불가시간이 없습니다.</div>
                ) : (
                  <ul style={{ marginTop: 8 }}>
                    {sortedProfBlocks.map((b, i) => (
                      <li key={i}>{formatBlock(GRID_CONFIG.startHour, b)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}