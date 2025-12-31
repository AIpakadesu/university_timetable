import { create } from "zustand";
import type { Assignment, TimetableInput, TimetableSolution } from "./types";
import { db } from "../db/db";
import { ensureDefaultPreset, getActivePresetId } from "../db/bootstrap";

type AppState = {
  presetId: string | null;
  loading: boolean;

  input: TimetableInput;
  solutions: TimetableSolution[];

  // ✅ 사용자가 직접 수정하는 임시 배치
  draftAssignments: Assignment[];

  // ✅ 미리보기에서 배치할 "선택 과목"
  selectedOfferingId: string;
  setSelectedOfferingId: (id: string) => void;

  init: () => Promise<void>;

  setInput: (patch: Partial<TimetableInput>) => void;

  setDraftAssignments: (next: Assignment[]) => void;
  placeDraft: (a: Assignment) => void;
  removeDraftByOffering: (offeringId: string) => void;

  saveAll: () => Promise<void>;
  loadAll: () => Promise<void>;
};

const emptyInput: TimetableInput = {
  professors: [],
  offerings: [],
  govtTrainingRules: [],
  majorBlockedRules: [],
  professorUnavailableRules: [],
  availability: [],
};

export const useAppStore = create<AppState>((set, get) => ({
  presetId: null,
  loading: true,

  input: emptyInput,
  solutions: [],
  draftAssignments: [],

  selectedOfferingId: "",
  setSelectedOfferingId: (id) => {
    set({ selectedOfferingId: id });
    // 선택값은 DB에 저장할 정도는 아니라서 localStorage로만 유지(새로고침 대비)
    localStorage.setItem("selectedOfferingId", id);
  },

  init: async () => {
    set({ loading: true });
    await ensureDefaultPreset();
    const presetId = await getActivePresetId();
    set({ presetId });

    await get().loadAll();

    // 로드 후 선택값 복구
    const saved = localStorage.getItem("selectedOfferingId") ?? "";
    set({ selectedOfferingId: saved });

    set({ loading: false });
  },

  setInput: (patch) => {
    const cur = get().input;
    set({ input: { ...cur, ...patch } });
  },

  setDraftAssignments: (next) => set({ draftAssignments: next }),

  placeDraft: (a) => {
    const cur = get().draftAssignments;
    const filtered = cur.filter((x) => x.offeringId !== a.offeringId);
    set({ draftAssignments: [...filtered, a] });
  },

  removeDraftByOffering: (offeringId) => {
    const cur = get().draftAssignments;
    set({ draftAssignments: cur.filter((x) => x.offeringId !== offeringId) });
  },

  loadAll: async () => {
    const presetId = get().presetId ?? (await getActivePresetId());

    const [
      professors,
      offerings,
      govtTrainingRules,
      majorBlockedRules,
      professorUnavailableRules,
      availability,
      solutions,
      draft,
    ] = await Promise.all([
      db.professors.where("presetId").equals(presetId).toArray(),
      db.offerings.where("presetId").equals(presetId).toArray(),
      db.govtTraining.where("presetId").equals(presetId).toArray(),
      db.majorBlocked.where("presetId").equals(presetId).toArray(),
      db.profUnavailable.where("presetId").equals(presetId).toArray(),
      db.availability.where("presetId").equals(presetId).toArray(),
      db.solutions.where("presetId").equals(presetId).toArray(),
      db.drafts.get(presetId),
    ]);

    set({
      input: {
        professors: professors.map(({ presetId: _p, ...x }) => x),
        offerings: offerings.map(({ presetId: _p, ...x }) => x),
        govtTrainingRules: govtTrainingRules.map(({ presetId: _p, ...x }) => x),
        majorBlockedRules: majorBlockedRules.map(({ presetId: _p, ...x }) => x),
        professorUnavailableRules: professorUnavailableRules.map(({ presetId: _p, ...x }) => x),
        availability: availability.map(({ presetId: _p, ...x }) => x),
      },
      solutions: solutions.map(({ presetId: _p, createdAt: _c, ...x }) => x),
      draftAssignments: draft?.assignments ?? [],
    });
  },

  saveAll: async () => {
    const presetId = get().presetId ?? (await getActivePresetId());
    const { input, solutions, draftAssignments } = get();

    await db.transaction(
      "rw",
      db.professors,
      db.offerings,
      db.govtTraining,
      db.majorBlocked,
      db.profUnavailable,
      db.availability,
      db.solutions,
      db.drafts,
      async () => {
        await db.professors.where("presetId").equals(presetId).delete();
        await db.offerings.where("presetId").equals(presetId).delete();
        await db.govtTraining.where("presetId").equals(presetId).delete();
        await db.majorBlocked.where("presetId").equals(presetId).delete();
        await db.profUnavailable.where("presetId").equals(presetId).delete();
        await db.availability.where("presetId").equals(presetId).delete();
        await db.solutions.where("presetId").equals(presetId).delete();

        await db.professors.bulkAdd(input.professors.map((x) => ({ ...x, presetId })));
        await db.offerings.bulkAdd(input.offerings.map((x) => ({ ...x, presetId })));

        await db.govtTraining.bulkAdd(input.govtTrainingRules.map((x) => ({ ...x, presetId })));
        await db.majorBlocked.bulkAdd(input.majorBlockedRules.map((x) => ({ ...x, presetId })));
        await db.profUnavailable.bulkAdd(input.professorUnavailableRules.map((x) => ({ ...x, presetId })));

        await db.availability.bulkAdd(input.availability.map((x) => ({ ...x, presetId })));

        await db.solutions.bulkAdd(solutions.map((x) => ({ ...x, presetId, createdAt: Date.now() })));

        await db.drafts.put({ presetId, assignments: draftAssignments, updatedAt: Date.now() });
      }
    );
  },
}));