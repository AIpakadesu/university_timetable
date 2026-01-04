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

function makeCellsFromBlocks(blocks: TimeBlock[]) {
  const s = new Set<string>();
  for (const b of blocks) {
    for (let t = b.startSlot; t < b.startSlot + b.slotLength; t++) {
      s.add(`${b.day}-${t}`);
    }
  }
  return s;
}

function makeCellsFromBlock(block: TimeBlock | null) {
  if (!block) return new Set<string>();
  return makeCellsFromBlocks([block]);
}

export default function AvailabilityGrid(props: {
  config: GridConfig;

  // 저장된 희망시간(블록 단위)
  selectedBlocks: TimeBlock[];

  // 시작점 표시용
  allowedStarts: Set<string>;

  // 점심시간 같은 보조 표시(연노랑)
  markedCells?: Set<string>;
  markedCellLabel?: string;

  // “주의 시작점” 표시용 (침범 가능 시작점)
  warnStarts?: Set<string>;

  // 마우스 오버/클릭 미리보기 블록
  previewBlock?: TimeBlock | null;

  // 셀 위에 올라갔을 때(또는 클릭할 때) 미리보기 시작점 전달
  onHoverStart?: (day: Day, startSlot: number | null) => void;

  // 시작점 토글
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

  const selectedFilled = makeCellsFromBlocks(selectedBlocks);
  const previewFilled = makeCellsFromBlock(previewBlock);

  // ✅ 경고 사선 패턴 (배경색을 덮지 않고 backgroundImage로 얹을 거라서 깔끔함)
  const warningStripe =
    "repeating-linear-gradient(45deg, rgba(255, 153, 0, 0.18) 0px, rgba(255, 153, 0, 0.18) 6px, rgba(255, 153, 0, 0.04) 6px, rgba(255, 153, 0, 0.04) 12px)";

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
                  const cellKey = `${d.key}-${slot}`;

                  const isLunch = markedCells.has(cellKey);
                  const isSelected = selectedFilled.has(cellKey);
                  const isPreview = previewFilled.has(cellKey);

                  const isStart = allowedStarts.has(cellKey);
                  const isWarn = warnStarts.has(cellKey);

                  // ✅ 기본 배경색 (점심은 항상 노랑이 보이게)
                  let bgColor = "white";
                  if (isLunch) bgColor = "#fff7d6";
                  if (!isLunch && isPreview) bgColor = "#f0f8ff";
                  if (!isLunch && isSelected) bgColor = "#e9f6ff";

                  // ✅ 점심 위에 선택/미리보기 들어오면 “파란 테두리”로 겹침 표시
                  const showBlueLine = isLunch && (isSelected || isPreview);
                  const lineColor = isSelected
                    ? "rgba(40,120,255,0.55)"
                    : "rgba(40,120,255,0.30)";

                  // ✅ 경고는 “칸 전체 노란 박스”가 아니라:
                  // - (점심 칸이 아니고)
                  // - (시작점으로 확정된 칸이 아니고)
                  // => backgroundImage로 은은한 사선만 얹기
                  const shouldStripe = isWarn && !isStart && !isLunch;

                  return (
                    <td
                      key={d.key}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        borderLeft: "1px solid #f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        userSelect: "none",

                        backgroundColor: bgColor,
                        backgroundImage: shouldStripe ? warningStripe : "none",

                        position: "relative",
                        borderRadius: 6,

                        // 시작점은 확실하게, 그 외는 은은하게
                        outline: isStart ? "2px solid rgba(0,0,0,0.22)" : "1px solid rgba(0,0,0,0.06)",
                        boxShadow: showBlueLine ? `inset 0 0 0 2px ${lineColor}` : "none",
                      }}
                      title={
                        isLunch
                          ? markedCellLabel
                          : isWarn
                          ? "주의: 점심/국비 제약을 침범할 수 있음 (클릭 시 경고)"
                          : "클릭: 희망시간 시작점 토글"
                      }
                      onMouseEnter={() => onHoverStart?.(d.key, slot)}
                      onMouseLeave={() => onHoverStart?.(d.key, null)}
                      // hover가 애매한 환경 대비: 클릭 전에도 미리보기 세팅
                      onMouseDown={() => onHoverStart?.(d.key, slot)}
                      onClick={() => {
                        onHoverStart?.(d.key, slot);
                        onToggle(d.key, slot);
                      }}
                    >
                      {/* 시작점은 그대로 크게 */}
                      {isStart ? "●" : ""}

                      {/* ✅ 경고 시작점은 "우측 상단 배지"로 깔끔하게 */}
                      {isWarn && !isStart && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 6,
                            fontSize: 12,
                            lineHeight: "12px",
                            padding: "3px 6px",
                            borderRadius: 999,
                            background: "rgba(255,153,0,0.12)",
                            border: "1px solid rgba(255,153,0,0.35)",
                            color: "rgba(130,80,0,0.95)",
                            fontWeight: 700,
                          }}
                        >
                          ⚠
                        </span>
                      )}
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