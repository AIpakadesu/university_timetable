import { useMemo } from "react";
import { useAppStore } from "../domain/store";

export default function InputPage() {
  const { input, setInput, selectedOfferingId, setSelectedOfferingId } = useAppStore();

  const professorOptions = input.professors;
  const offeringMap = useMemo(() => new Map(input.offerings.map((o) => [o.id, o])), [input.offerings]);

  return (
    <div style={{ padding: 16 }}>
      <h3>입력</h3>

      <section style={{ marginBottom: 16 }}>
        <h4>교수</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const id = `p_${Math.random().toString(36).slice(2, 8)}`;
              setInput({ professors: [...input.professors, { id, name: `교수${input.professors.length + 1}` }] });
            }}
          >
            교수 추가
          </button>
          <span style={{ opacity: 0.7 }}>현재 {input.professors.length}명</span>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h4>과목(개설)</h4>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            disabled={professorOptions.length === 0}
            onClick={() => {
              if (professorOptions.length === 0) return;

              const id = `o_${Math.random().toString(36).slice(2, 8)}`;
              const professorId = professorOptions[0].id;

              const next = {
                id,
                courseName: `과목${input.offerings.length + 1}`,
                grade: 1,
                majorType: "MAJOR" as const,
                professorId,
                slotLength: 6,
                mustBeConsecutive: true,
              };

              setInput({ offerings: [...input.offerings, next] });
              setSelectedOfferingId(id);
            }}
          >
            과목 추가
          </button>

          {professorOptions.length === 0 && (
            <span style={{ color: "#b00" }}>※ 먼저 교수부터 추가해주세요</span>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <b>배치할 과목 선택(미리보기에서 클릭 배치): </b>
          <select
            value={selectedOfferingId}
            onChange={(e) => setSelectedOfferingId(e.target.value)}
            style={{ padding: 6, marginLeft: 8, minWidth: 240 }}
          >
            <option value="">(선택 안 함)</option>
            {input.offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.courseName} / {o.grade}학년
              </option>
            ))}
          </select>

          <p style={{ opacity: 0.7, marginTop: 6 }}>
            선택한 과목을 미리보기 그리드에서 클릭하면 그 시간에 배치됩니다.
          </p>
        </div>

        <hr />

        <div>
          <b>과목 목록</b>
          <ul>
            {input.offerings.map((o) => (
              <li key={o.id}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>{o.courseName}</span>
                  <span style={{ opacity: 0.7 }}>{o.id}</span>

                  <label>
                    학년:
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={o.grade}
                      onChange={(e) => {
                        const grade = Number(e.target.value);
                        setInput({
                          offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, grade } : x)),
                        });
                      }}
                      style={{ width: 60, marginLeft: 6 }}
                    />
                  </label>

                  <label>
                    전공/교양:
                    <select
                      value={o.majorType}
                      onChange={(e) => {
                        const majorType = e.target.value as "MAJOR" | "LIBERAL";
                        setInput({
                          offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, majorType } : x)),
                        });
                      }}
                      style={{ marginLeft: 6 }}
                    >
                      <option value="MAJOR">전공</option>
                      <option value="LIBERAL">교양</option>
                    </select>
                  </label>

                  <label>
                    담당교수:
                    <select
                      value={o.professorId}
                      onChange={(e) => {
                        const professorId = e.target.value;
                        setInput({
                          offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, professorId } : x)),
                        });
                      }}
                      style={{ marginLeft: 6 }}
                    >
                      {input.professors.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    시수(30분 슬롯):
                    <select
                      value={o.slotLength}
                      onChange={(e) => {
                        const slotLength = Number(e.target.value);
                        setInput({
                          offerings: input.offerings.map((x) => (x.id === o.id ? { ...x, slotLength } : x)),
                        });
                      }}
                      style={{ marginLeft: 6 }}
                    >
                      <option value={4}>2시간(4)</option>
                      <option value={6}>3시간(6)</option>
                      <option value={8}>4시간(8)</option>
                    </select>
                  </label>

                  <button
                    onClick={() => {
                      setInput({ offerings: input.offerings.filter((x) => x.id !== o.id) });
                      // 삭제한 과목이 선택되어 있으면 선택 해제
                      if (selectedOfferingId === o.id) setSelectedOfferingId("");
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ opacity: 0.7 }}>
        <p>선택 과목은 store에 저장되므로 미리보기 탭에서도 그대로 유지됩니다.</p>
      </section>
    </div>
  );
}