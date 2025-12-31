import { useMemo, useState } from "react";
import { useAppStore } from "../domain/store";
import type { Day, OfferingAvailability, TimeBlock } from "../domain/types";
import AvailabilityGrid from "../ui/AvailabilityGrid";

const GRID_CONFIG = { startHour: 9, endHour: 18, slotMinutes: 30 };

export default function ConstraintsPage() {
  const { input, setInput } = useAppStore();
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");

  const offering = input.offerings.find((o) => o.id === selectedOfferingId);

  const slotsPerHour = 60 / GRID_CONFIG.slotMinutes;
  const totalSlots = (GRID_CONFIG.endHour - GRID_CONFIG.startHour) * slotsPerHour;

  const currentAllowedBlocks = useMemo<TimeBlock[]>(() => {
    if (!selectedOfferingId) return [];
    const row = input.availability.find((a) => a.offeringId === selectedOfferingId);
    return row?.allowedBlocks ?? [];
  }, [input.availability, selectedOfferingId]);

  const allowedStartsSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of currentAllowedBlocks) s.add(`${b.day}-${b.startSlot}`);
    return s;
  }, [currentAllowedBlocks]);

  const disabledStartsSet = useMemo(() => {
    const s = new Set<string>();
    if (!offering) return s;
    // 시작 슬롯 + 시수(slotLength)가 표 범위를 넘으면 선택 불가 처리
    for (let startSlot = 0; startSlot < totalSlots; startSlot++) {
      if (startSlot + offering.slotLength > totalSlots) {
        for (const day of ["MON","TUE","WED","THU","FRI"] as Day[]) {
          s.add(`${day}-${startSlot}`);
        }
      }
    }
    return s;
  }, [offering, totalSlots]);

  function upsertAvailability(offeringId: string, allowedBlocks: TimeBlock[]) {
    const others = input.availability.filter((a) => a.offeringId !== offeringId);
    const row: OfferingAvailability = { offeringId, allowedBlocks };
    setInput({ availability: [...others, row] });
  }

  function toggleAllowed(day: Day, startSlot: number) {
    if (!offering) return;

    const key = `${day}-${startSlot}`;
    const next = [...currentAllowedBlocks];

    const idx = next.findIndex((b) => b.day === day && b.startSlot === startSlot && b.slotLength === offering.slotLength);

    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      next.push({ day, startSlot, slotLength: offering.slotLength });
    }

    upsertAvailability(offering.id, next);
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>제약조건</h3>

      <section style={{ marginBottom: 16 }}>
        <h4>국비교육(오후 불가) 학년 규칙</h4>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>현재 {input.govtTrainingRules.length}개</span>
          <button
            onClick={() => {
              setInput({
                govtTrainingRules: [...input.govtTrainingRules, { grade: 2, afternoonStartSlot: 8 }],
              });
            }}
          >
            예시 추가
          </button>
          <button onClick={() => setInput({ govtTrainingRules: [] })}>초기화</button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h4>교양 운영으로 전공 배치 불가</h4>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>현재 {input.majorBlockedRules.length}개</span>
          <button
            onClick={() => {
              setInput({
                majorBlockedRules: [...input.majorBlockedRules, { day: "WED", startSlot: 0, slotLength: 18 }],
              });
            }}
          >
            예시 추가
          </button>
          <button onClick={() => setInput({ majorBlockedRules: [] })}>초기화</button>
        </div>
      </section>

      <hr />

      <section style={{ marginBottom: 16 }}>
        <h4>과목 희망 시간(가능 시작시간) 설정</h4>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <b>대상 과목:</b>
          <select value={selectedOfferingId} onChange={(e) => setSelectedOfferingId(e.target.value)} style={{ padding: 6, minWidth: 260 }}>
            <option value="">(선택)</option>
            {input.offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.courseName} / {o.grade}학년
              </option>
            ))}
          </select>

          {offering && (
            <span style={{ opacity: 0.7 }}>
              시수: {offering.slotLength} 슬롯(30분 기준) / 시작시간을 “가능”으로 지정하세요
            </span>
          )}

          {offering && (
            <button onClick={() => upsertAvailability(offering.id, [])}>
              이 과목 희망시간 초기화
            </button>
          )}
        </div>

        {!offering ? (
          <div style={{ opacity: 0.7 }}>과목을 선택하면 그리드가 나타납니다.</div>
        ) : (
          <>
            <AvailabilityGrid
              config={GRID_CONFIG}
              allowedStarts={allowedStartsSet}
              disabledStarts={disabledStartsSet}
              onToggle={toggleAllowed}
            />
            <p style={{ opacity: 0.7, marginTop: 8 }}>
              초록색 = 해당 과목 “시작 가능 시간”입니다. 미리보기에서 배치 추천도 이 범위 안에서만 나옵니다.
            </p>
          </>
        )}
      </section>
    </div>
  );
}