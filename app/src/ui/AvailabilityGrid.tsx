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

function blockCellsSet(block: TimeBlock | null) {
  const s = new Set<string>();
  if (!block) return s;
  for (let t = block.startSlot; t < block.startSlot + block.slotLength; t++) {
    s.add(`${block.day}-${t}`);
  }
  return s;
}

export default function AvailabilityGrid(props: {
  config: GridConfig;

  // ✅ 저장된 희망시간(블록 단위): 시수만큼 범위 색칠
  selectedBlocks: TimeBlock[];

  // ✅ 시작점 표시용(●)
  allowedStarts: Set<string>;

  // ✅ 점심시간 같은 보조 표시(연노랑)
  markedCells?: Set<string>;
  markedCellLabel?: string;

  // ✅ 경고(점심/국비 침범 가능) 시작점 표시용(⚠︎)
  warnStarts?: Set<string>;

  // ✅ 마우스 오버 시 “이 시작점이면 어디까지 먹는지” 미리보기
  previewBlock?: TimeBlock | null;
  onHoverStart?: (day: Day, startSlot: number | null) => void;

  onToggle: (day: Day, startSlot: number) => void;
}) {
  const {
    config,
    selectedBlocks,
    allowedStarts,
    markedCells = new Set<string>(),
    markedCellLabel = "점심시간",
    warnStarts = new Set<string>(),
    previewBlock = null,
    onHoverStart,
    onToggle,
  } = props;

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  // ✅ 선택된 블록 범위(파란색)
  const selectedFilled = new Set<string>();
  for (const b of selectedBlocks) {
    for (let t = b.startSlot; t < b.startSlot + b.slotLength; t++) {
      selectedFilled.add(`${b.day}-${t}`);
    }
  }

  // ✅ 미리보기 블록 범위(연한 파란색)
  const previewFilled = blockCellsSet(previewBlock);

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
                    userSelect: "none",
                  }}
                >
                  {timeLabel}
                </td>

                {DAYS.map((d) => {
                  const key = `${d.key}-${slot}`;

                  const isLunch = markedCells.has(key);
                  const isSelected = selectedFilled.has(key);
                  const isPreview = previewFilled.has(key);

                  const isStartSelected = allowedStarts.has(key);
                  const isWarnStart = warnStarts.has(key);

                  // ✅ 배경: 점심(노랑)은 “항상” 보이게.
                  // 선택/미리보기는 파란색으로 범위가 보이게 하되,
                  // 점심과 겹치면 노랑을 유지 + 파란 라인(표시)만 추가해서 둘 다 보이게 처리.
                  let bg = "white";
                  if (isLunch) bg = "#fff7d6";
                  if (!isLunch && isPreview) bg = "#f0f8ff"; // 미리보기(연한 파랑)
                  if (!isLunch && isSelected) bg = "#e9f6ff"; // 선택(파랑)

                  // 점심 + (미리보기/선택) 겹침 표시용 라인
                  const showBlueLine = isLunch && (isPreview || isSelected);
                  const lineColor = isSelected ? "rgba(40,120,255,0.55)" : "rgba(40,120,255,0.30)";

                  return (
                    <td
                      key={d.key}
                      onMouseEnter={() => onHoverStart?.(d.key, slot)}
                      onMouseLeave={() => onHoverStart?.(d.key, null)}
                      onClick={() => onToggle(d.key, slot)}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        borderLeft: "1px solid #f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        userSelect: "none",
                        background: bg,

                        // 시작점 시각화
                        outline: isStartSelected
                          ? "2px solid rgba(0,0,0,0.22)"
                          : isWarnStart
                          ? "2px solid rgba(255,140,0,0.35)"
                          : "none",

                        fontWeight: isStartSelected ? 700 : 400,
                        color: "#222",

                        // 점심과 겹치면 파란 라인으로 “이 범위가 점심을 침범함”을 시각적으로 표시
                        boxShadow: showBlueLine ? `inset 0 0 0 2px ${lineColor}` : "none",
                      }}
                      title={
                        isLunch
                          ? markedCellLabel
                          : isWarnStart
                          ? "주의: 점심/국비 제약을 침범할 수 있음 (클릭 시 경고)"
                          : "클릭: 희망시간 시작점 토글"
                      }
                    >
                      {/* 텍스트 최소: 시작점은 ●, 경고는 ! */}
                      {isStartSelected ? "●" : isWarnStart ? "!" : ""}
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