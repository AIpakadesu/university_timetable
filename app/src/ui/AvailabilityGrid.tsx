import type { Day, TimeBlock } from "../domain/types";

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

export default function AvailabilityGrid(props: {
  config: GridConfig;

  // ✅ 선택된 희망시간(블록 단위) - 시수만큼 범위 색칠에 사용
  selectedBlocks: TimeBlock[];

  // ✅ 시작점(클릭 가능한 “시작시간” 셀) 표시용
  allowedStarts: Set<string>;

  // ✅ “선택 불가 시작점” (점심/국비 등으로 인해 금지)
  disabledStarts: Set<string>;

  // ✅ 그리드에 “보조 표시” (ex. 점심시간 셀)
  markedCells?: Set<string>;
  markedCellLabel?: string;

  onToggle: (day: Day, startSlot: number) => void;
}) {
  const {
    config,
    selectedBlocks,
    allowedStarts,
    disabledStarts,
    markedCells = new Set<string>(),
    markedCellLabel = "점심시간",
    onToggle,
  } = props;

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  // ✅ 블록 범위(시수만큼) 칠하기용 Set
  const filledCells = new Set<string>();
  for (const b of selectedBlocks) {
    for (let s = b.startSlot; s < b.startSlot + b.slotLength; s++) {
      filledCells.add(`${b.day}-${s}`);
    }
  }

  return (
    <div style={{ overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
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
                    background: "white",
                  }}
                >
                  {timeLabel}
                </td>

                {DAYS.map((d) => {
                  const key = `${d.key}-${slot}`;

                  const isStartSelected = allowedStarts.has(key);
                  const isDisabledStart = disabledStarts.has(key);

                  // ✅ 시수만큼 칠해지는 “범위 색”
                  const isFilled = filledCells.has(key);

                  // ✅ 점심시간 같은 “보조 표시”
                  const isMarked = markedCells.has(key);

                  // 배경 우선순위: 금지(시작점) > 점심표시 > 선택범위 > 기본
                  let bg = "white";
                  if (isMarked) bg = "#fff7d6"; // 점심시간 느낌(연노랑)
                  if (isFilled) bg = "#e9f6ff"; // 희망시간 범위(연파랑)
                  if (isMarked && isFilled) bg = "#e6f7e6"; // 둘 겹치면(원래 선택 못 하게 막을 거라 거의 안 나옴)
                  if (isDisabledStart) bg = "#f3f3f3";

                  const cursor = isDisabledStart ? "not-allowed" : "pointer";

                  return (
                    <td
                      key={d.key}
                      onClick={() => {
                        if (isDisabledStart) return;
                        onToggle(d.key, slot);
                      }}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        borderLeft: "1px solid #f5f5f5",
                        padding: "6px 8px",
                        cursor,
                        userSelect: "none",
                        background: bg,

                        // ✅ 시작점은 더 진하게 표시(“여기가 시작!”)
                        outline: isStartSelected ? "2px solid rgba(0,0,0,0.22)" : "none",
                        fontWeight: isStartSelected ? 700 : 400,
                        color: isDisabledStart ? "#999" : "#222",
                      }}
                      title={
                        isDisabledStart
                          ? "선택 불가(점심/국비 제약)"
                          : isMarked
                          ? markedCellLabel
                          : "클릭: 희망시간 시작점 토글"
                      }
                    >
                      {/* 셀 안 글자 최소화: 시작점만 점 표시 */}
                      {isStartSelected ? "●" : ""}
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