import type { Assignment, Day, TimetableInput } from "../domain/types";
import type { MouseEvent } from "react";

export type GridConfig = {
  startHour: number;
  endHour: number;
  slotMinutes: number;
};

const DAYS: { key: Day; label: string }[] = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
];

function slotToTime(config: GridConfig, slot: number) {
  const minutesFromStart = slot * config.slotMinutes;
  const totalMinutes = config.startHour * 60 + minutesFromStart;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function inBlock(a: Assignment, day: Day, slot: number) {
  if (a.block.day !== day) return false;
  return slot >= a.block.startSlot && slot < a.block.startSlot + a.block.slotLength;
}

export default function TimetableGrid(props: {
  input: TimetableInput;
  config: GridConfig;
  assignments: Assignment[];
  redCells: Set<string>;

  // ✅ 점심시간 표시용(추가)
  markedCells?: Set<string>;
  markedCellLabel?: string;

  onCellClick: (day: Day, slot: number, e: MouseEvent<HTMLTableCellElement>) => void;
}) {
  const {
    input,
    config,
    assignments,
    redCells,
    markedCells = new Set<string>(),
    markedCellLabel = "점심시간",
    onCellClick,
  } = props;

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  const offeringMap = new Map(input.offerings.map((o) => [o.id, o]));
  const profMap = new Map(input.professors.map((p) => [p.id, p]));

  return (
    <div style={{ overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", minWidth: 820, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", top: 0, background: "white", borderBottom: "1px solid #eee", padding: 8 }}>
              시간
            </th>
            {DAYS.map((d) => (
              <th key={d.key} style={{ position: "sticky", top: 0, background: "white", borderBottom: "1px solid #eee", padding: 8 }}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: totalSlots }).map((_, slot) => {
            const timeLabel = slotToTime(config, slot);

            return (
              <tr key={slot}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 80, color: "#555" }}>
                  {timeLabel}
                </td>

                {DAYS.map((d) => {
                  const cellKey = `${d.key}-${slot}`;
                  const isRed = redCells.has(cellKey);
                  const isLunch = markedCells.has(cellKey);

                  const coverings = assignments.filter((a) => inBlock(a, d.key, slot));
                  const covering = coverings[0];
                  const hasClass = coverings.length > 0;
                  const isStart = !!(covering && covering.block.day === d.key && covering.block.startSlot === slot);

                  let label = "";
                  if (coverings.length >= 2) {
                    label = `겹침 ${coverings.length}`;
                  } else if (covering && isStart) {
                    const off = offeringMap.get(covering.offeringId);
                    const prof = off ? profMap.get(off.professorId) : undefined;
                    label = off ? `${off.courseName} / ${prof?.name ?? "교수?"} / ${off.grade}학년` : covering.offeringId;
                  }

                  // ✅ 배경 우선순위:
                  // 1) 충돌 빨강
                  // 2) 수업 배치 파랑
                  // 3) 점심 노랑
                  // 4) 흰색
                  let bg = "white";
                  if (isLunch) bg = "#fff7d6";
                  if (hasClass) bg = "#f7fbff";
                  if (isRed) bg = "#ffe5e5";

                  // 점심 위에 수업이 올라가면: 노랑을 유지하는 대신 “겹쳤다”를 파란 테두리로 보여줌
                  const showLunchAndClass = isLunch && hasClass && !isRed;

                  return (
                    <td
                      key={d.key}
                      onClick={(e) => onCellClick(d.key, slot, e)}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        borderLeft: "1px solid #f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        verticalAlign: "top",

                        // ✅ 점심+수업이면 노랑 바탕 유지
                        background: showLunchAndClass ? "#fff7d6" : bg,

                        // ✅ 점심+수업 겹침을 파란 라인으로 표시
                        boxShadow: showLunchAndClass ? "inset 0 0 0 2px rgba(40,120,255,0.35)" : "none",

                        fontWeight: isStart || coverings.length >= 2 ? 600 : 400,
                        color: isStart || coverings.length >= 2 ? "#111" : "#666",
                        borderRadius: 6,
                      }}
                      title={
                        isRed
                          ? "충돌/제약 위반 가능 (Option+클릭: 삭제)"
                          : isLunch
                          ? `${markedCellLabel} (클릭은 가능)`
                          : "클릭: 배치 / Option+클릭: 삭제"
                      }
                    >
                      {label}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}