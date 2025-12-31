import { useMemo, useState } from "react";
import type { Day, OfferingAvailability, TimeBlock } from "../domain/types";
import { useAppStore } from "../domain/store";
import AvailabilityGrid from "../ui/AvailabilityGrid";
import UnavailabilityGrid from "../ui/UnavailabilityGrid";

const GRID_CONFIG = { startHour: 9, endHour: 18, slotMinutes: 60 };
const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI"];

export default function WishTimesPage() {
  const { input, setInput, maxGrade } = useAppStore();
  const [mode, setMode] = useState<"COURSE" | "PROF">("COURSE");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("");

  const offering = input.offerings.find((o) => o.id === selectedOfferingId);

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

  const disabledStartsSet = useMemo(() => {
    const s = new Set<string>();
    if (!offering) return s;
    for (let startSlot = 0; startSlot < totalSlots; startSlot++) {
      if (startSlot + offering.slotLength > totalSlots) {
        for (const day of DAYS) s.add(`${day}-${startSlot}`);
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
    const next = [...currentAllowedBlocks];
    const idx = next.findIndex((b) => b.day === day && b.startSlot === startSlot && b.slotLength === offering.slotLength);
    if (idx >= 0) next.splice(idx, 1);
    else next.push({ day, startSlot, slotLength: offering.slotLength });
    upsertAvailability(offering.id, next);
  }

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

  return (
    <div style={{ padding: 16 }}>
      <h3>희망시간</h3>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <b>보기:</b>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: 6 }}>
          <option value="COURSE">과목별</option>
          <option value="PROF">교수별</option>
        </select>
      </div>

      {mode === "COURSE" ? (
        <section>
          <h4>과목별 희망 시작시간</h4>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <b>과목:</b>
            <select value={selectedOfferingId} onChange={(e) => setSelectedOfferingId(e.target.value)} style={{ padding: 6, minWidth: 260 }}>
              <option value="">(선택)</option>
              {input.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.courseName} / {o.grade}학년
                </option>
              ))}
            </select>

            {offering && (
              <>
                <span style={{ opacity: 0.7 }}>시수: {offering.slotLength}시간</span>
                <button onClick={() => upsertAvailability(offering.id, [])}>초기화</button>
              </>
            )}
          </div>

          {!offering ? (
            <div style={{ opacity: 0.7 }}>과목을 선택하면 그리드가 나타납니다.</div>
          ) : (
            <>
              <h4 style={{ marginTop: 6 }}>{offering.grade}학년 그리드(1개만 표시)</h4>
              <AvailabilityGrid
                config={GRID_CONFIG}
                allowedStarts={allowedStartsSet}
                disabledStarts={disabledStartsSet}
                onToggle={toggleAllowed}
              />
            </>
          )}
        </section>
      ) : (
        <section>
          <h4>교수별 불가시간</h4>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <b>교수:</b>
            <select value={selectedProfessorId} onChange={(e) => setSelectedProfessorId(e.target.value)} style={{ padding: 6, minWidth: 260 }}>
              <option value="">(선택)</option>
              {input.professors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
              <p style={{ opacity: 0.7 }}>
                교수 불가시간은 학년과 무관하므로, 어느 학년 그리드에서 클릭해도 같은 불가시간이 저장됩니다.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
