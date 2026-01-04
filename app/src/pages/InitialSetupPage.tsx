import { useMemo, useState } from "react";
import type { Day, MajorType, TimeBlock } from "../domain/types";
import { useAppStore } from "../domain/store";

const GRID_START_HOUR = 9;

// 설정 화면에서 시간 선택 폭(너무 짧으면 16시 이후 설정이 불편함)
const MAX_SLOTS = 12; // 09:00 ~ 21:00 (9 + 12)

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
  const h = startHour + slot;
  return `${String(h).padStart(2, "0")}:00`;
}

function formatLunchRules(rules: TimeBlock[], startHour = 9) {
  if (!rules || rules.length === 0) return "설정 없음";

  const same =
    rules.every((r) => r.startSlot === rules[0].startSlot && r.slotLength === rules[0].slotLength);

  if (same && rules.length >= 3) {
    const s = slotToTime(startHour, rules[0].startSlot);
    const e = slotToTime(startHour, rules[0].startSlot + rules[0].slotLength);
    return `월~금 ${s}~${e} (${rules[0].slotLength}시간)`;
  }

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

type ClassSplitMode = "BULK" | "PER_SECTION";

/** 국비교육: 특정 학년은 afternoonStartSlot 이후 수업 배치 불가 */
type GovtTrainingRule = {
  grade: number;
  afternoonStartSlot: number; // 09:00 기준 슬롯
};

export default function InitialSetupPage() {
  const { input, setInput, maxGrade, setMaxGrade } = useAppStore();

  // ✅ 실수 방지 잠금
  const [unlocked, setUnlocked] = useState(false);

  // 점심 설정
  const [lunchStartHour, setLunchStartHour] = useState<number>(12);
  const [lunchLen, setLunchLen] = useState<number>(1);

  // 교수 추가 폼
  const [newProfName, setNewProfName] = useState("");
  const [newProfTargetHours, setNewProfTargetHours] = useState<number>(18);

  // 검색
  const [profQuery, setProfQuery] = useState("");
  const [courseQuery, setCourseQuery] = useState("");

  // 과목 추가 폼
  const [newCourseName, setNewCourseName] = useState("과목");
  const [newGrade, setNewGrade] = useState(1);
  const [newMajorType, setNewMajorType] = useState<MajorType>("MAJOR");
  const [newSlotLength, setNewSlotLength] = useState(3);

  // 반 배정
  const [classSplitMode, setClassSplitMode] = useState<ClassSplitMode>("BULK");

  const [bulkProfessorId, setBulkProfessorId] = useState<string>("");
  const [profA, setProfA] = useState<string>("");
  const [profB, setProfB] = useState<string>("");
  const [profC, setProfC] = useState<string>("");

  // ---- (중요) 사라졌던 설정들: input에 필드가 없더라도 TS 터지지 않게 안전 처리 ----
  const anyInput = input as any;

  const govtTrainingRules: GovtTrainingRule[] = (anyInput.govtTrainingRules ?? []) as GovtTrainingRule[];
  const majorBlockedRules: TimeBlock[] = (anyInput.majorBlockedRules ?? []) as TimeBlock[];

  // ---- UI helpers (칩/뱃지 정도만 inline 유지) ----
  const chip = (kind: "gray" | "blue" | "green" | "yellow") => {
    const bg =
      kind === "blue"
        ? "#edf4ff"
        : kind === "green"
        ? "#eafaf1"
        : kind === "yellow"
        ? "#fff6da"
        : "#f5f5f5";
    const color =
      kind === "blue"
        ? "#1d4ed8"
        : kind === "green"
        ? "#0f766e"
        : kind === "yellow"
        ? "#8a5a00"
        : "#555";
    return {
      padding: "4px 8px",
      borderRadius: 999,
      background: bg,
      color,
      fontSize: 12,
      border: "1px solid rgba(0,0,0,0.05)",
      whiteSpace: "nowrap" as const,
    };
  };

  const badgeStyle = {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#f3f6ff",
    color: "#2b4cff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid #e7ecff",
    flex: "0 0 auto",
  } as const;

  const subtle = { opacity: 0.65, fontSize: 12 } as const;

  function badgeText(name: string, idx: number) {
    const t = (name ?? "").trim();
    if (t.length > 0) return t.slice(0, 1);
    return `P${idx + 1}`;
  }

  const timeSlotOptions = Array.from({ length: MAX_SLOTS + 1 }, (_, slot) => slot);

  // 교수 기본 선택값 세팅
  useMemo(() => {
    const first = input.professors[0]?.id ?? "";
    if (!bulkProfessorId) setBulkProfessorId(first);
    if (!profA) setProfA(first);
    if (!profB) setProfB(first);
    if (!profC) setProfC(first);
  }, [input.professors, bulkProfessorId, profA, profB, profC]);

  function applyLunchToWeekdays() {
    if (!unlocked) return;
    const startSlot = hourToSlot(lunchStartHour);
    const blockLen = Math.max(1, Math.min(2, Math.floor(lunchLen)));

    const rules: TimeBlock[] = DAYS.map((d) => ({
      day: d.key,
      startSlot,
      slotLength: blockLen,
    }));

    setInput({ lunchRules: rules } as any);
  }

  // ===== 국비교육 설정 =====
  function addGovtRule() {
    if (!unlocked) return;
    const next = [...govtTrainingRules, { grade: 1, afternoonStartSlot: hourToSlot(13) }];
    setInput({ govtTrainingRules: next } as any);
  }

  function updateGovtRule(idx: number, patch: Partial<GovtTrainingRule>) {
    if (!unlocked) return;
    const next = govtTrainingRules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setInput({ govtTrainingRules: next } as any);
  }

  function deleteGovtRule(idx: number) {
    if (!unlocked) return;
    const next = govtTrainingRules.filter((_, i) => i !== idx);
    setInput({ govtTrainingRules: next } as any);
  }

  // ===== 교양 운영(전공 배치 불가) 설정 =====
  function addMajorBlockedRule() {
    if (!unlocked) return;
    const next: TimeBlock[] = [
      ...majorBlockedRules,
      { day: "WED", startSlot: 0, slotLength: 9 }, // 예시: 수요일 09~18 전공 불가
    ];
    setInput({ majorBlockedRules: next } as any);
  }

  function updateMajorBlockedRule(idx: number, patch: Partial<TimeBlock>) {
    if (!unlocked) return;
    const next = majorBlockedRules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setInput({ majorBlockedRules: next } as any);
  }

  function deleteMajorBlockedRule(idx: number) {
    if (!unlocked) return;
    const next = majorBlockedRules.filter((_, i) => i !== idx);
    setInput({ majorBlockedRules: next } as any);
  }

  // ===== 교수 CRUD =====
  function addProfessor() {
    if (!unlocked) return;

    const id = `p_${Math.random().toString(36).slice(2, 8)}`;
    const name =
      newProfName.trim().length > 0 ? newProfName.trim() : `교수${input.professors.length + 1}`;

    const targetHours = Number.isFinite(newProfTargetHours)
      ? Math.max(0, Math.floor(newProfTargetHours))
      : 0;

    setInput({
      professors: [
        ...input.professors,
        {
          id,
          name,
          targetHours,
        },
      ],
    } as any);

    setNewProfName("");
  }

  function updateProfessorName(professorId: string, name: string) {
    if (!unlocked) return;
    const next = input.professors.map((p) => (p.id === professorId ? { ...p, name } : p));
    setInput({ professors: next } as any);
  }

  function updateProfessorTargetHours(professorId: string, targetHours: number) {
    if (!unlocked) return;
    const v = Number.isFinite(targetHours) ? Math.max(0, Math.floor(targetHours)) : 0;
    const next = input.professors.map((p) => (p.id === professorId ? { ...p, targetHours: v } : p));
    setInput({ professors: next } as any);
  }

  function deleteProfessor(professorId: string) {
    if (!unlocked) return;

    const nextOfferings = input.offerings.filter((o) => o.professorId !== professorId);
    const nextProfessors = input.professors.filter((p) => p.id !== professorId);

    const offeringIds = new Set(nextOfferings.map((o) => o.id));
    const nextAvailability = input.availability.filter((a) => offeringIds.has(a.offeringId));

    setInput({
      professors: nextProfessors,
      offerings: nextOfferings,
      availability: nextAvailability,
    } as any);
  }

  function requestDeleteProfessor(professorId: string) {
    if (!unlocked) return;

    const prof = input.professors.find((p) => p.id === professorId);
    if (!prof) return;

    const affectedOfferings = input.offerings.filter((o) => o.professorId === professorId);
    const count = affectedOfferings.length;

    const sample = affectedOfferings
      .slice(0, 5)
      .map((o) => `- ${o.courseName} (${o.grade}학년)`)
      .join("\n");

    const more = count > 5 ? `\n... 외 ${count - 5}개` : "";

    const msg =
      `교수 "${prof.name}"을(를) 삭제하시겠습니까?\n\n` +
      `⚠️ 함께 삭제되는 항목\n` +
      `- 해당 교수가 담당인 과목: ${count}개\n` +
      `- 해당 과목들의 희망시간(availability) 설정\n\n` +
      (count > 0 ? `삭제 대상 과목 예시:\n${sample}${more}\n\n` : "") +
      `진행할까요?`;

    if (!window.confirm(msg)) return;
    deleteProfessor(professorId);
  }

  // ===== 과목 CRUD =====
  function addOfferingOne(courseName: string, grade: number, professorId: string) {
    const id = `o_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      courseName,
      grade,
      majorType: newMajorType,
      professorId,
      slotLength: newSlotLength,
      mustBeConsecutive: true,
    };
  }

  function addOffering() {
    if (!unlocked) return;
    if (input.professors.length === 0) return;

    const baseName = newCourseName.trim() || "과목";
    const grade = Math.max(1, Math.min(maxGrade, newGrade));

    if (classSplitMode === "BULK") {
      const pid = bulkProfessorId || input.professors[0].id;
      const courseName = `${baseName} (A/B/C)`;
      const newOne = addOfferingOne(courseName, grade, pid);
      setInput({ offerings: [...input.offerings, newOne] } as any);
      return;
    }

    const pidA = profA || input.professors[0].id;
    const pidB = profB || input.professors[0].id;
    const pidC = profC || input.professors[0].id;

    const a = addOfferingOne(`${baseName} (A반)`, grade, pidA);
    const b = addOfferingOne(`${baseName} (B반)`, grade, pidB);
    const c = addOfferingOne(`${baseName} (C반)`, grade, pidC);

    setInput({ offerings: [...input.offerings, a, b, c] } as any);
  }

  function deleteOffering(offeringId: string) {
    if (!unlocked) return;
    setInput({
      offerings: input.offerings.filter((o) => o.id !== offeringId),
      availability: input.availability.filter((a) => a.offeringId !== offeringId),
    } as any);
  }

  function requestDeleteOffering(offeringId: string) {
    if (!unlocked) return;

    const o = input.offerings.find((x) => x.id === offeringId);
    if (!o) return;

    const profName = input.professors.find((p) => p.id === o.professorId)?.name ?? "교수?";
    const availEntries = input.availability.filter((a) => a.offeringId === offeringId).length;

    const msg =
      `과목 "${o.courseName}"을(를) 삭제하시겠습니까?\n\n` +
      `정보\n` +
      `- 학년: ${o.grade}학년\n` +
      `- 담당교수: ${profName}\n` +
      `- 구분: ${o.majorType === "MAJOR" ? "전공" : "교양"}\n` +
      `- 시수: ${o.slotLength}시간\n\n` +
      `⚠️ 함께 삭제되는 항목\n` +
      `- 해당 과목의 희망시간(availability) 설정: ${availEntries}개 항목\n\n` +
      `진행할까요?`;

    if (!window.confirm(msg)) return;
    deleteOffering(offeringId);
  }

  const filteredProfessors = input.professors.filter((p) =>
    `${p.name} ${p.id}`.toLowerCase().includes(profQuery.toLowerCase())
  );

  const filteredOfferings = input.offerings.filter((o) =>
    `${o.courseName}`.toLowerCase().includes(courseQuery.toLowerCase())
  );

  return (
    <div className="page">
      <h3>초기 설정</h3>

      <div className="card" style={{ marginBottom: 14 }}>
        <label className="row">
          <input
            type="checkbox"
            checked={unlocked}
            onChange={(e) => setUnlocked(e.target.checked)}
          />
          <b>초기 설정 잠금 해제</b>
          <span style={{ opacity: 0.7 }}>(체크해야 수정 가능)</span>
        </label>
      </div>

      {/* 총 학년 */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>총 학년 수</h4>
        <div className="row">
          <input
            className="input"
            type="number"
            min={1}
            max={8}
            value={maxGrade}
            disabled={!unlocked}
            onChange={(e) => setMaxGrade(Number(e.target.value))}
            style={{ width: 90 }}
          />
          <span style={{ opacity: 0.7 }}>
            플래너/희망시간에서 1~{maxGrade}학년 그리드를 씁니다.
          </span>
        </div>
      </section>

      {/* 점심 */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>점심시간(전체 공통 불가)</h4>

        <div className="row">
          <label className="field">
            <span className="nowrap">시작</span>
            <select
              className="input"
              disabled={!unlocked}
              value={lunchStartHour}
              onChange={(e) => setLunchStartHour(Number(e.target.value))}
            >
              {[10, 11, 12, 13, 14].map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="nowrap">길이</span>
            <select
              className="input"
              disabled={!unlocked}
              value={lunchLen}
              onChange={(e) => setLunchLen(Number(e.target.value))}
            >
              {[1, 2].map((x) => (
                <option key={x} value={x}>
                  {x}시간
                </option>
              ))}
            </select>
          </label>

          <button className="btn" disabled={!unlocked} onClick={applyLunchToWeekdays}>
            월~금 적용
          </button>
          <button
            className="btn"
            disabled={!unlocked}
            onClick={() => setInput({ lunchRules: [] } as any)}
          >
            점심시간 제거
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="card" style={{ background: "#fafafa" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <b>현재 점심시간:</b>{" "}
                <span style={{ opacity: 0.85 }}>
                  {formatLunchRules(input.lunchRules, GRID_START_HOUR)}
                </span>
              </div>
              <div style={subtle}>(필요하면 아래에서 자세히 보기)</div>
            </div>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", opacity: 0.8 }}>자세히 보기(디버깅)</summary>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: 10,
                  borderRadius: 8,
                  marginTop: 8,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(input.lunchRules, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </section>

      {/* ✅ 국비교육 */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>국비교육(학년별 오후 수업 불가)</h4>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="row">
            <button className="btn" disabled={!unlocked} onClick={addGovtRule}>
              + 규칙 추가
            </button>
            <button
              className="btn"
              disabled={!unlocked}
              onClick={() => setInput({ govtTrainingRules: [] } as any)}
            >
              전체 초기화
            </button>
            <span style={{ opacity: 0.7 }}>
              예: 2학년이 13:00 이후 불가면 “학년=2, 오후시작=13:00”
            </span>
          </div>
        </div>

        {govtTrainingRules.length === 0 ? (
          <div style={{ opacity: 0.7 }}>설정된 국비교육 제한이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {govtTrainingRules.map((r, idx) => (
              <div key={idx} className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <label className="field">
                      <span className="nowrap">학년</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={maxGrade}
                        disabled={!unlocked}
                        value={r.grade}
                        onChange={(e) =>
                          updateGovtRule(idx, {
                            grade: Math.max(1, Math.min(maxGrade, Number(e.target.value))),
                          })
                        }
                        style={{ width: 90 }}
                      />
                    </label>

                    <label className="field">
                      <span className="nowrap">오후 시작(불가)</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={r.afternoonStartSlot}
                        onChange={(e) =>
                          updateGovtRule(idx, { afternoonStartSlot: Number(e.target.value) })
                        }
                      >
                        {timeSlotOptions.map((slot) => (
                          <option key={slot} value={slot}>
                            {slotToTime(GRID_START_HOUR, slot)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <span style={{ opacity: 0.7 }}>
                      → {r.grade}학년은 {slotToTime(GRID_START_HOUR, r.afternoonStartSlot)} 이후 배치 불가
                    </span>
                  </div>

                  <button className="btnDanger" disabled={!unlocked} onClick={() => deleteGovtRule(idx)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ✅ 교양 운영일(전공 배치 불가) */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>교양 운영(전공 배치 불가 시간)</h4>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="row">
            <button className="btn" disabled={!unlocked} onClick={addMajorBlockedRule}>
              + 규칙 추가
            </button>
            <button
              className="btn"
              disabled={!unlocked}
              onClick={() => setInput({ majorBlockedRules: [] } as any)}
            >
              전체 초기화
            </button>
            <span style={{ opacity: 0.7 }}>이 구간은 “전공”만 배치 불가(교양은 가능)</span>
          </div>
        </div>

        {majorBlockedRules.length === 0 ? (
          <div style={{ opacity: 0.7 }}>설정된 교양 운영 제한이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {majorBlockedRules.map((r, idx) => (
              <div key={idx} className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <label className="field">
                      <span className="nowrap">요일</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={r.day}
                        onChange={(e) => updateMajorBlockedRule(idx, { day: e.target.value as Day })}
                      >
                        {DAYS.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="nowrap">시작</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={r.startSlot}
                        onChange={(e) => updateMajorBlockedRule(idx, { startSlot: Number(e.target.value) })}
                      >
                        {timeSlotOptions.map((slot) => (
                          <option key={slot} value={slot}>
                            {slotToTime(GRID_START_HOUR, slot)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="nowrap">길이(시간)</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={MAX_SLOTS}
                        disabled={!unlocked}
                        value={r.slotLength}
                        onChange={(e) =>
                          updateMajorBlockedRule(idx, { slotLength: Math.max(1, Math.min(MAX_SLOTS, Number(e.target.value))) })
                        }
                        style={{ width: 110 }}
                      />
                    </label>

                    <span style={{ opacity: 0.7 }}>
                      → {dayLabel(r.day)} {slotToTime(GRID_START_HOUR, r.startSlot)} ~{" "}
                      {slotToTime(GRID_START_HOUR, r.startSlot + r.slotLength)} 전공 불가
                    </span>
                  </div>

                  <button className="btnDanger" disabled={!unlocked} onClick={() => deleteMajorBlockedRule(idx)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr />

      {/* 교수 관리 */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>교수 관리</h4>

        <div className="row" style={{ marginBottom: 10 }}>
          <input
            className="input"
            value={profQuery}
            onChange={(e) => setProfQuery(e.target.value)}
            placeholder="교수 검색 (이름/ID)"
            style={{ minWidth: 240, flex: 1 }}
          />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row">
            <input
              className="input"
              value={newProfName}
              disabled={!unlocked}
              onChange={(e) => setNewProfName(e.target.value)}
              placeholder="새 교수 이름 (비우면 자동 이름)"
              style={{ minWidth: 240, flex: 1 }}
            />

            <label className="field">
              <span className="nowrap">목표 시수</span>
              <input
                className="input"
                type="number"
                min={0}
                disabled={!unlocked}
                value={newProfTargetHours}
                onChange={(e) => setNewProfTargetHours(Number(e.target.value))}
                style={{ width: 110 }}
              />
            </label>

            <button className="btn" disabled={!unlocked} onClick={addProfessor}>
              + 교수 추가
            </button>

            <span style={subtle}>화면이 줄면 4→2→1열로 자동 변경됩니다.</span>
          </div>
        </div>

        {filteredProfessors.length === 0 ? (
          <div style={{ opacity: 0.7 }}>표시할 교수가 없습니다.</div>
        ) : (
          <div className="profGrid">
            {filteredProfessors.map((p, idx) => (
              <div key={p.id} className="card profCard">
                <div className="row" style={{ marginBottom: 4 }}>
                  <div style={badgeStyle}>{badgeText(p.name, idx)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, lineHeight: 1.1, wordBreak: "break-word" }}>
                      {p.name}
                    </div>
                    <div style={subtle}>ID: {p.id}</div>
                  </div>
                </div>

                <div className="row">
                  <span style={chip("yellow")}>목표 {p.targetHours ?? 0}시간</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    className="input"
                    value={p.name}
                    disabled={!unlocked}
                    onChange={(e) => updateProfessorName(p.id, e.target.value)}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!unlocked) return;
                      if (v === "") updateProfessorName(p.id, `교수${idx + 1}`);
                      else if (v !== e.target.value) updateProfessorName(p.id, v);
                    }}
                    placeholder="교수명 수정"
                  />

                  <label className="field">
                    <span className="nowrap">목표 시수</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      disabled={!unlocked}
                      value={p.targetHours ?? 0}
                      onChange={(e) => updateProfessorTargetHours(p.id, Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                  </label>

                  <button className="btnDanger" disabled={!unlocked} onClick={() => requestDeleteProfessor(p.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr />

      {/* 과목 관리 */}
      <section style={{ marginBottom: 18, opacity: unlocked ? 1 : 0.6 }}>
        <h4>과목 관리(추가/삭제)</h4>

        {input.professors.length === 0 ? (
          <div style={{ color: "#b00" }}>먼저 교수부터 추가해주세요.</div>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                className="input"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="과목 검색"
                style={{ minWidth: 240, flex: 1 }}
              />
            </div>

            <div className="twoCol" style={{ marginBottom: 12 }}>
              <div className="card">
                <div style={{ fontWeight: 900, marginBottom: 8 }}>기본 정보</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label className="field">
                    <span className="nowrap">과목명</span>
                    <input
                      className="input"
                      disabled={!unlocked}
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                  </label>

                  <div className="row">
                    <label className="field">
                      <span className="nowrap">학년</span>
                      <input
                        className="input"
                        disabled={!unlocked}
                        type="number"
                        min={1}
                        max={maxGrade}
                        value={newGrade}
                        onChange={(e) => setNewGrade(Number(e.target.value))}
                        style={{ width: 90 }}
                      />
                    </label>

                    <label className="field">
                      <span className="nowrap">전공/교양</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={newMajorType}
                        onChange={(e) => setNewMajorType(e.target.value as MajorType)}
                      >
                        <option value="MAJOR">전공</option>
                        <option value="LIBERAL">교양</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="nowrap">시수</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={newSlotLength}
                        onChange={(e) => setNewSlotLength(Number(e.target.value))}
                      >
                        <option value={2}>2시간</option>
                        <option value={3}>3시간</option>
                        <option value={4}>4시간</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 900, marginBottom: 8 }}>ABC반 배정 방식</div>

                <div className="row" style={{ marginBottom: 10 }}>
                  <label className="field">
                    <input
                      type="radio"
                      disabled={!unlocked}
                      checked={classSplitMode === "BULK"}
                      onChange={() => setClassSplitMode("BULK")}
                    />
                    <span className="nowrap">일괄 (한 교수가 A/B/C 전체)</span>
                  </label>

                  <label className="field">
                    <input
                      type="radio"
                      disabled={!unlocked}
                      checked={classSplitMode === "PER_SECTION"}
                      onChange={() => setClassSplitMode("PER_SECTION")}
                    />
                    <span className="nowrap">개별 (A/B/C를 교수별로 나눔)</span>
                  </label>
                </div>

                {classSplitMode === "BULK" ? (
                  <label className="field">
                    <span className="nowrap">담당 교수</span>
                    <select
                      className="input"
                      disabled={!unlocked}
                      value={bulkProfessorId}
                      onChange={(e) => setBulkProfessorId(e.target.value)}
                      style={{ flex: 1, minWidth: 220 }}
                    >
                      {input.professors.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (목표 {p.targetHours ?? 0}h)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label className="field">
                      <span className="nowrap">A반 담당</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={profA}
                        onChange={(e) => setProfA(e.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                      >
                        {input.professors.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (목표 {p.targetHours ?? 0}h)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="nowrap">B반 담당</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={profB}
                        onChange={(e) => setProfB(e.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                      >
                        {input.professors.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (목표 {p.targetHours ?? 0}h)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span className="nowrap">C반 담당</span>
                      <select
                        className="input"
                        disabled={!unlocked}
                        value={profC}
                        onChange={(e) => setProfC(e.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                      >
                        {input.professors.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (목표 {p.targetHours ?? 0}h)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <button
                  className="btn"
                  disabled={!unlocked}
                  onClick={addOffering}
                  style={{ marginTop: 12, width: "100%" }}
                >
                  + 과목 추가
                </button>

                <div style={{ marginTop: 8, ...subtle }}>
                  일괄은 1개 과목(“A/B/C”), 개별은 A/B/C 과목 3개가 생성됩니다.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredOfferings.length === 0 ? (
                <div style={{ opacity: 0.7 }}>등록된 과목이 없습니다.</div>
              ) : (
                filteredOfferings.map((o) => {
                  const profName =
                    input.professors.find((p) => p.id === o.professorId)?.name ?? "교수?";
                  const majorChip = o.majorType === "MAJOR" ? chip("blue") : chip("green");

                  return (
                    <div key={o.id} className="card">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, wordBreak: "break-word" }}>
                            {o.courseName}
                          </div>
                          <div className="row" style={{ marginTop: 6 }}>
                            <span style={chip("gray")}>{o.grade}학년</span>
                            <span style={majorChip}>{o.majorType === "MAJOR" ? "전공" : "교양"}</span>
                            <span style={chip("yellow")}>{o.slotLength}시간</span>
                            <span style={chip("gray")}>{profName}</span>
                          </div>
                          <div style={{ marginTop: 6, ...subtle }}>ID: {o.id}</div>
                        </div>

                        <button
                          className="btnDanger"
                          disabled={!unlocked}
                          onClick={() => requestDeleteOffering(o.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>

      {/* 디버그: 사라졌나 안 사라졌나 확인용 */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", opacity: 0.8 }}>설정 디버그(확인용)</summary>
        <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8, overflow: "auto" }}>
          {JSON.stringify(
            {
              lunchRules: input.lunchRules,
              govtTrainingRules,
              majorBlockedRules,
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}