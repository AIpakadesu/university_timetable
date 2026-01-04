import { useMemo, useState } from "react";
import type { Day, MajorType, TimeBlock } from "../domain/types";
import { useAppStore } from "../domain/store";

const GRID_START_HOUR = 9;

const DAYS: { key: Day; label: string }[] = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
];

function dayLabel(day: Day) {
  return ({ MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금" } as const)[day];
}

function slotToTime(startHour: number, slot: number) {
  const h = startHour + slot; // slotMinutes=60 기준
  return `${String(h).padStart(2, "0")}:00`;
}

function formatLunchRules(rules: TimeBlock[], startHour = 9) {
  if (!rules || rules.length === 0) return "설정 없음";

  // 월~금이 같은 시간으로 통일돼 있으면 한 줄로
  const same =
    rules.every((r) => r.startSlot === rules[0].startSlot && r.slotLength === rules[0].slotLength);

  if (same && rules.length >= 3) {
    const s = slotToTime(startHour, rules[0].startSlot);
    const e = slotToTime(startHour, rules[0].startSlot + rules[0].slotLength);
    return `월~금 ${s}~${e} (${rules[0].slotLength}시간)`;
  }

  // 아니면 요일별로 나열
  return rules
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => {
      const s = slotToTime(startHour, r.startSlot);
      const e = slotToTime(startHour, r.startSlot + r.slotLength);
      return `${dayLabel(r.day)} ${s}~${e}`;
    })
    .join(" · ");
}

function hourToSlot(hour: number) {
  return hour - GRID_START_HOUR;
}

export default function InitialSetupPage() {
  const { input, setInput, maxGrade, setMaxGrade } = useAppStore();

  // ✅ 실수 방지 잠금
  const [unlocked, setUnlocked] = useState(false);

  // 점심 설정(기본 12~13)
  const [lunchStartHour, setLunchStartHour] = useState<number>(12);
  const [lunchLen, setLunchLen] = useState<number>(1);

  // 과목 추가 폼
  const [newCourseName, setNewCourseName] = useState("과목");
  const [newGrade, setNewGrade] = useState(1);
  const [newMajorType, setNewMajorType] = useState<MajorType>("MAJOR");
  const [newSlotLength, setNewSlotLength] = useState(3);
  const [newProfessorId, setNewProfessorId] = useState<string>("");

  useMemo(() => {
    if (!newProfessorId && input.professors[0]) setNewProfessorId(input.professors[0].id);
  }, [input.professors, newProfessorId]);

  function applyLunchToWeekdays() {
    if (!unlocked) return;
    const startSlot = hourToSlot(lunchStartHour);
    const blockLen = Math.max(1, Math.min(2, Math.floor(lunchLen)));

    const rules: TimeBlock[] = DAYS.map((d) => ({
      day: d.key,
      startSlot,
      slotLength: blockLen,
    }));

    setInput({ lunchRules: rules });
  }

  function addProfessor() {
    if (!unlocked) return;
    const id = `p_${Math.random().toString(36).slice(2, 8)}`;
    setInput({ professors: [...input.professors, { id, name: `교수${input.professors.length + 1}` }] });
    if (!newProfessorId) setNewProfessorId(id);
  }

  function deleteProfessor(professorId: string) {
    if (!unlocked) return;
    // 해당 교수가 담당인 과목도 같이 삭제
    const nextOfferings = input.offerings.filter((o) => o.professorId !== professorId);
    const nextProfessors = input.professors.filter((p) => p.id !== professorId);
    // availability도 같이 정리
    const offeringIds = new Set(nextOfferings.map(o => o.id));
    const nextAvailability = input.availability.filter(a => offeringIds.has(a.offeringId));
    setInput({ professors: nextProfessors, offerings: nextOfferings, availability: nextAvailability });
  }

  function addOffering() {
    if (!unlocked) return;
    if (input.professors.length === 0) return;
    const professorId = newProfessorId || input.professors[0].id;

    const id = `o_${Math.random().toString(36).slice(2, 8)}`;
    setInput({
      offerings: [
        ...input.offerings,
        {
          id,
          courseName: newCourseName,
          grade: Math.max(1, Math.min(maxGrade, newGrade)),
          majorType: newMajorType,
          professorId,
          slotLength: newSlotLength,
          mustBeConsecutive: true,
        },
      ],
    });
  }

  function deleteOffering(offeringId: string) {
    if (!unlocked) return;
    setInput({
      offerings: input.offerings.filter((o) => o.id !== offeringId),
      availability: input.availability.filter((a) => a.offeringId !== offeringId),
    });
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>초기 설정</h3>

      <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, marginBottom: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={unlocked} onChange={(e) => setUnlocked(e.target.checked)} />
          <b>초기 설정 잠금 해제</b>
          <span style={{ opacity: 0.7 }}>(체크해야 수정 가능)</span>
        </label>
      </div>

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>총 학년 수</h4>
        <input
          type="number"
          min={1}
          max={8}
          value={maxGrade}
          disabled={!unlocked}
          onChange={(e) => setMaxGrade(Number(e.target.value))}
          style={{ width: 90, padding: 6 }}
        />
        <span style={{ marginLeft: 10, opacity: 0.7 }}>플래너/희망시간에서 1~{maxGrade}학년 그리드를 씁니다.</span>
      </section>

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>점심시간(전체 공통 불가)</h4>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            시작:
            <select disabled={!unlocked} value={lunchStartHour} onChange={(e) => setLunchStartHour(Number(e.target.value))} style={{ marginLeft: 6, padding: 6 }}>
              {[10, 11, 12, 13, 14].map((h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </label>

          <label>
            길이:
            <select disabled={!unlocked} value={lunchLen} onChange={(e) => setLunchLen(Number(e.target.value))} style={{ marginLeft: 6, padding: 6 }}>
              {[1, 2].map((x) => (
                <option key={x} value={x}>{x}시간</option>
              ))}
            </select>
          </label>

          <button disabled={!unlocked} onClick={applyLunchToWeekdays}>월~금 적용</button>
          <button disabled={!unlocked} onClick={() => setInput({ lunchRules: [] })}>점심시간 제거</button>
        </div>

        <div style={{ marginTop: 10 }}>
  <div
    style={{
      padding: "10px 12px",
      border: "1px solid #eee",
      borderRadius: 10,
      background: "#fafafa",
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <div>
      <b>현재 점심시간:</b>{" "}
      <span style={{ opacity: 0.85 }}>{formatLunchRules(input.lunchRules, GRID_START_HOUR)}</span>
    </div>

    <div style={{ opacity: 0.6, fontSize: 12 }}>
      (필요하면 아래에서 자세히 보기)
    </div>
  </div>

  <details style={{ marginTop: 8 }}>
    <summary style={{ cursor: "pointer", opacity: 0.8 }}>자세히 보기(디버깅)</summary>
    <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8, marginTop: 8 }}>
      {JSON.stringify(input.lunchRules, null, 2)}
    </pre>
  </details>
</div>
      </section>

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>국비교육(학년별 오후 불가)</h4>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            disabled={!unlocked}
            onClick={() => setInput({ govtTrainingRules: [...input.govtTrainingRules, { grade: 2, afternoonStartSlot: 4 }] })}
          >
            예시 추가(2학년 13시부터 불가)
          </button>
          <button disabled={!unlocked} onClick={() => setInput({ govtTrainingRules: [] })}>초기화</button>
        </div>

        <ul>
          {input.govtTrainingRules.map((r, idx) => (
            <li key={idx} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{r.grade}학년</b> afternoonStartSlot={r.afternoonStartSlot}
              <button disabled={!unlocked} onClick={() => setInput({ govtTrainingRules: input.govtTrainingRules.filter((_, i) => i !== idx) })}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>교양 운영(전공 배치 불가 시간)</h4>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            disabled={!unlocked}
            onClick={() => setInput({ majorBlockedRules: [...input.majorBlockedRules, { day: "WED", startSlot: 0, slotLength: 9 }] })}
          >
            예시 추가(수요일 09~18 전공 불가)
          </button>
          <button disabled={!unlocked} onClick={() => setInput({ majorBlockedRules: [] })}>초기화</button>
        </div>

        <ul>
          {input.majorBlockedRules.map((r, idx) => (
            <li key={idx} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select
                disabled={!unlocked}
                value={r.day}
                onChange={(e) => {
                  const day = e.target.value as Day;
                  setInput({ majorBlockedRules: input.majorBlockedRules.map((x, i) => (i === idx ? { ...x, day } : x)) });
                }}
              >
                {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              startSlot:
              <input
                disabled={!unlocked}
                type="number"
                value={r.startSlot}
                onChange={(e) => {
                  const startSlot = Number(e.target.value);
                  setInput({ majorBlockedRules: input.majorBlockedRules.map((x, i) => (i === idx ? { ...x, startSlot } : x)) });
                }}
                style={{ width: 70 }}
              />
              len:
              <input
                disabled={!unlocked}
                type="number"
                value={r.slotLength}
                onChange={(e) => {
                  const slotLength = Number(e.target.value);
                  setInput({ majorBlockedRules: input.majorBlockedRules.map((x, i) => (i === idx ? { ...x, slotLength } : x)) });
                }}
                style={{ width: 70 }}
              />
              <button disabled={!unlocked} onClick={() => setInput({ majorBlockedRules: input.majorBlockedRules.filter((_, i) => i !== idx) })}>삭제</button>
            </li>
          ))}
        </ul>
      </section>

      <hr />

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>교수 관리</h4>
        <button disabled={!unlocked} onClick={addProfessor}>교수 추가</button>
        <ul>
          {input.professors.map((p) => (
            <li key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{p.name}</b> <span style={{ opacity: 0.6 }}>{p.id}</span>
              <button disabled={!unlocked} onClick={() => deleteProfessor(p.id)}>삭제</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>과목 관리(추가/삭제)</h4>

        {input.professors.length === 0 ? (
          <div style={{ color: "#b00" }}>먼저 교수부터 추가해주세요.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label>
                과목명:
                <input disabled={!unlocked} value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} style={{ marginLeft: 6, padding: 6 }} />
              </label>

              <label>
                학년:
                <input
                  disabled={!unlocked}
                  type="number"
                  min={1}
                  max={maxGrade}
                  value={newGrade}
                  onChange={(e) => setNewGrade(Number(e.target.value))}
                  style={{ marginLeft: 6, padding: 6, width: 70 }}
                />
              </label>

              <label>
                전공/교양:
                <select disabled={!unlocked} value={newMajorType} onChange={(e) => setNewMajorType(e.target.value as MajorType)} style={{ marginLeft: 6, padding: 6 }}>
                  <option value="MAJOR">전공</option>
                  <option value="LIBERAL">교양</option>
                </select>
              </label>

              <label>
                담당교수:
                <select disabled={!unlocked} value={newProfessorId} onChange={(e) => setNewProfessorId(e.target.value)} style={{ marginLeft: 6, padding: 6 }}>
                  {input.professors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

              <label>
                시수:
                <select disabled={!unlocked} value={newSlotLength} onChange={(e) => setNewSlotLength(Number(e.target.value))} style={{ marginLeft: 6, padding: 6 }}>
                  <option value={2}>2시간</option>
                  <option value={3}>3시간</option>
                  <option value={4}>4시간</option>
                </select>
              </label>

              <button disabled={!unlocked} onClick={addOffering}>과목 추가</button>
            </div>

            <hr />

            <ul>
              {input.offerings.map((o) => (
                <li key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b>{o.courseName}</b>
                  <span style={{ opacity: 0.7 }}>{o.grade}학년</span>
                  <span style={{ opacity: 0.7 }}>{o.majorType === "MAJOR" ? "전공" : "교양"}</span>
                  <span style={{ opacity: 0.7 }}>{o.slotLength}시간</span>
                  <span style={{ opacity: 0.7 }}>
                    {input.professors.find((p) => p.id === o.professorId)?.name ?? "교수?"}
                  </span>
                  <span style={{ opacity: 0.6 }}>{o.id}</span>
                  <button disabled={!unlocked} onClick={() => deleteOffering(o.id)}>삭제</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
