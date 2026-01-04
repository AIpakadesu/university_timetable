import type { Assignment, Day, TimetableInput, TimeBlock } from "../domain/types";

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
  redCells?: Set<string>;
  onCellClick: (day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const {
    input,
    config,
    assignments,
    onCellClick,
    disabled = false,
    disabledReason = "선택한 과목 학년이 아니라 배치할 수 없습니다.",
  } = props;

  const redCells = props.redCells ?? new Set<string>();

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  const offeringMap = new Map(input.offerings.map((o) => [o.id, o]));
  const profMap = new Map(input.professors.map((p) => [p.id, p]));

  // ✅ 점심시간 셀 표시(연노랑)
  const lunchRules: TimeBlock[] = ((input as any)?.lunchRules ?? []) as TimeBlock[];
  const lunchCellSet = new Set<string>();
  for (const b of lunchRules) {
    for (let s = b.startSlot; s < b.startSlot + b.slotLength; s++) {
      lunchCellSet.add(`${b.day}-${s}`);
    }
  }

  function handleCellClick(day: Day, slot: number, e: React.MouseEvent<HTMLTableCellElement>) {
    if (disabled) return;
    onCellClick(day, slot, e);
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "auto",
        border: disabled ? "1px solid #f0f0f0" : "1px solid #eee",
        borderRadius: 10,
        opacity: disabled ? 0.72 : 1,
        filter: disabled ? "brightness(0.92)" : "none",
        background: disabled ? "#fafafa" : "transparent",
        transition: "opacity 120ms ease, filter 120ms ease",
      }}
    >
      {disabled && (
        <div
          title={disabledReason}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            padding: 10,
            pointerEvents: "auto",
            cursor: "not-allowed",
            background: "rgba(250,250,250,0.10)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #e8e8e8",
              background: "rgba(255,255,255,0.9)",
              fontSize: 12,
              opacity: 0.85,
              userSelect: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            🔒 배치 불가
          </div>
        </div>
      )}

      <table style={{ borderCollapse: "collapse", minWidth: 820, width: "100%" }}>
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "white",
                borderBottom: "1px solid #eee",
                padding: 8,
                zIndex: 1,
              }}
            >
              시간
            </th>
            {DAYS.map((d) => (
              <th
                key={d.key}
                style={{
                  position: "sticky",
                  top: 0,
                  background: "white",
                  borderBottom: "1px solid #eee",
                  padding: 8,
                  zIndex: 1,
                }}
              >
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
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "6px 8px",
                    width: 80,
                    color: "#555",
                    background: disabled ? "#fafafa" : "white",
                  }}
                >
                  {timeLabel}
                </td>

                {DAYS.map((d) => {
                  const cellKey = `${d.key}-${slot}`;
                  const isRed = redCells.has(cellKey);
                  const isLunch = lunchCellSet.has(cellKey);

                  const coverings = assignments.filter((a) => inBlock(a, d.key, slot));
                  const covering = coverings[0];
                  const isStart = !!covering && covering.block.day === d.key && covering.block.startSlot === slot;

                  let label = "";
                  if (coverings.length >= 2) {
                    label = `겹침 ${coverings.length}`;
                  } else if (covering && isStart) {
                    const off = offeringMap.get(covering.offeringId);
                    const prof = off ? profMap.get(off.professorId) : undefined;
                    label = off
                      ? `${off.courseName} / ${prof?.name ?? "교수?"} / ${off.grade}학년`
                      : covering.offeringId;
                  }

                  const baseBg = covering ? "#f7fbff" : "white";
                  // 우선순위: 빨강 > 점심(연노랑) > 기본(배치/흰색)
                  const bg = isRed ? "#ffe5e5" : isLunch ? "#fff7d6" : baseBg;

                  return (
                    <td
                      key={d.key}
                      onClick={(e) => handleCellClick(d.key, slot, e)}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        borderLeft: "1px solid #f5f5f5",
                        padding: "6px 8px",
                        cursor: disabled ? "not-allowed" : "pointer",
                        verticalAlign: "top",
                        background: bg,
                        fontWeight: isStart || coverings.length >= 2 ? 600 : 400,
                        color: isStart || coverings.length >= 2 ? "#111" : "#666",
                        userSelect: "none",
                      }}
                      title={
                        disabled
                          ? disabledReason
                          : isRed
                          ? "충돌/제약 위반 가능 (Option+클릭: 삭제)"
                          : isLunch
                          ? "점심시간"
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