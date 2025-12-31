import { create } from "zustand";
import type { Assignment, TimetableInput, TimetableSolution } from "./types";
import { db } from "../db/db";
import { ensureDefaultPreset, getActivePresetId } from "../db/bootstrap";

type AppState = {
  presetId: string | null;
  loading: boolean;

  input: TimetableInput;
  solutions: TimetableSolution[];
  draftAssignments: Assignment[];

  selectedOfferingId: string;
  setSelectedOfferingId: (id: string) => void;

  maxGrade: number;
  setMaxGrade: (n: number) => Promise<void>;

  init: () => Promise<void>;
  setInput: (patch: Partial<TimetableInput>) => void;

  placeDraft: (a: Assignment) => void;
  removeDraftByOffering: (offeringId: string) => void;

  saveAll: () => Promise<void>;
  loadAll: () => Promise<void>;
};

const emptyInput: TimetableInput = {
  professors: [],
  offerings: [],

  lunchRules: [],
  govtTrainingRules: [],
  majorBlockedRules: [],

  professorUnavailableRules: [],
  availability: [],
};

function clampGrade(n: number) {
  const x = Math.floor(Number(n));
  if (Number.isNaN(x)) return 4;
  return Math.max(1, Math.min(8, x));
}

export const useAppStore = create<AppState>((set, get) => ({
  presetId: null,
  loading: true,

  input: emptyInput,
  solutions: [],
  draftAssignments: [],

  selectedOfferingId: "",
  setSelectedOfferingId: (id) => {
    set({ selectedOfferingId: id });
    localStorage.setItem("selectedOfferingId", id);
  },

  maxGrade: 4,
  setMaxGrade: async (n) => {
    const v = clampGrade(n);
    set({ maxGrade: v });
    await db.meta.put({ key: "MAX_GRADE", value: String(v) });
  },

  init: async () => {
    set({ loading: true });

    await ensureDefaultPreset();
    const presetId = await getActivePresetId();
    set({ presetId });

    const meta = await db.meta.get("MAX_GRADE");
    set({ maxGrade: clampGrade(meta?.value ?? 4) });

    await get().loadAll();
    set({ selectedOfferingId: localStorage.getItem("selectedOfferingId") ?? "" });

    set({ loading: false });
  },

  setInput: (patch) => {
    set({ input: { ...get().input, ...patch } });
  },

  placeDraft: (a) => {
    const cur = get().draftAssignments;
    set({ draftAssignments: [...cur.filter((x) => x.offeringId !== a.offeringId), a] });
  },

  removeDraftByOffering: (offeringId) => {
    set({ draftAssignments: get().draftAssignments.filter((x) => x.offeringId !== offeringId) });
  },

  loadAll: async () => {
    const presetId = get().presetId ?? (await getActivePresetId());

    const [
      professors,
      offerings,
      lunchRules,
      govtTrainingRules,
      majorBlockedRules,
      professorUnavailableRules,
      availability,
      solutions,
      draft,
    ] = await Promise.all([
      db.professors.where("presetId").equals(presetId).toArray(),
      db.offerings.where("presetId").equals(presetId).toArray(),
      db.lunch.where("presetId").equals(presetId).toArray(),
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

        lunchRules: lunchRules.map(({ presetId: _p, ...x }) => x),
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
      db.lunch,
      db.govtTraining,
      db.majorBlocked,
      db.profUnavailable,
      db.availability,
      db.solutions,
      db.drafts,
      async () => {
        await db.professors.where("presetId").equals(presetId).delete();
        await db.offerings.where("presetId").equals(presetId).delete();
        await db.lunch.where("presetId").equals(presetId).delete();
        await db.govtTraining.where("presetId").equals(presetId).delete();
        await db.majorBlocked.where("presetId").equals(presetId).delete();
        await db.profUnavailable.where("presetId").equals(presetId).delete();
        await db.availability.where("presetId").equals(presetId).delete();
        await db.solutions.where("presetId").equals(presetId).delete();

        await db.professors.bulkAdd(input.professors.map((x) => ({ ...x, presetId })));
        await db.offerings.bulkAdd(input.offerings.map((x) => ({ ...x, presetId })));

        await db.lunch.bulkAdd(input.lunchRules.map((x) => ({ ...x, presetId })));
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