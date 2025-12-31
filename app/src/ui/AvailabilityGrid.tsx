import type { Day } from "../domain/types";

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
  allowedStarts: Set<string>; // key = "DAY-startSlot"
  disabledStarts: Set<string>; // key = "DAY-startSlot"
  onToggle: (day: Day, startSlot: number) => void;
}) {
  const { config, allowedStarts, disabledStarts, onToggle } = props;

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  return (
    <div style={{ overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", minWidth: 820, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", top: 0, background: "white", borderBottom: "1px solid #eee", padding: 8 }}>
              시작
            </th>
            {DAYS.map((d) => (
              <th key={d.key} style={{ position: "sticky", top: 0, background: "white", borderBottom: "1px solid #eee", padding: 8 }}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: totalSlots }).map((_, startSlot) => (
            <tr key={startSlot}>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 80, color: "#555" }}>
                {slotToTime(config, startSlot)}
              </td>

              {DAYS.map((d) => {
                const key = `${d.key}-${startSlot}`;
                const allowed = allowedStarts.has(key);
                const disabled = disabledStarts.has(key);

                return (
                  <td
                    key={d.key}
                    onClick={() => !disabled && onToggle(d.key, startSlot)}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      borderLeft: "1px solid #f5f5f5",
                      padding: "6px 8px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      background: disabled ? "#f3f3f3" : allowed ? "#dff3df" : "white",
                      color: disabled ? "#999" : "#111",
                      fontWeight: allowed ? 700 : 400,
                      userSelect: "none",
                    }}
                    title={disabled ? "해당 시작시간은 불가(시간이 범위를 벗어남)" : allowed ? "가능(클릭하면 해제)" : "불가(클릭하면 가능으로)"}
                  >
                    {allowed ? "가능" : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}