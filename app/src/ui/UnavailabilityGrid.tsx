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
  const totalMinutes = config.startHour * 60 + slot * config.slotMinutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function UnavailabilityGrid(props: {
  config: GridConfig;
  blocked: Set<string>; // "DAY-slot"
  onToggle: (day: Day, startSlot: number) => void;
}) {
  const { config, blocked, onToggle } = props;

  const slotsPerHour = 60 / config.slotMinutes; // 1
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

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
          {Array.from({ length: totalSlots }).map((_, slot) => (
            <tr key={slot}>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 8px", width: 80, color: "#555" }}>
                {slotToTime(config, slot)}
              </td>

              {DAYS.map((d) => {
                const key = `${d.key}-${slot}`;
                const isBlocked = blocked.has(key);

                return (
                  <td
                    key={d.key}
                    onClick={() => onToggle(d.key, slot)}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      borderLeft: "1px solid #f5f5f5",
                      padding: "6px 8px",
                      cursor: "pointer",
                      background: isBlocked ? "#ffe5e5" : "white",
                      fontWeight: isBlocked ? 700 : 400,
                      userSelect: "none",
                    }}
                    title={isBlocked ? "불가(클릭하면 해제)" : "가능(클릭하면 불가로 설정)"}
                  >
                    {isBlocked ? "불가" : ""}
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