import { create } from "zustand";
import type { TimetableInput, TimetableSolution } from "./types";
import { db } from "../db/db";
import { ensureDefaultPreset, getActivePresetId } from "../db/bootstrap";

type AppState = {
  presetId: string | null;
  loading: boolean;

  input: TimetableInput;
  solutions: TimetableSolution[];

  init: () => Promise<void>;

  setInput: (patch: Partial<TimetableInput>) => void;
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

  init: async () => {
    set({ loading: true });
    await ensureDefaultPreset();
    const presetId = await getActivePresetId();
    set({ presetId });

    await get().loadAll();
    set({ loading: false });
  },

  setInput: (patch) => {
    const cur = get().input;
    const next = { ...cur, ...patch };
    set({ input: next });
  },

  loadAll: async () => {
    const presetId = get().presetId ?? (await getActivePresetId());

    const [professors, offerings, govtTrainingRules, majorBlockedRules, professorUnavailableRules, availability, solutions] =
      await Promise.all([
        db.professors.where("presetId").equals(presetId).toArray(),
        db.offerings.where("presetId").equals(presetId).toArray(),
        db.govtTraining.where("presetId").equals(presetId).toArray(),
        db.majorBlocked.where("presetId").equals(presetId).toArray(),
        db.profUnavailable.where("presetId").equals(presetId).toArray(),
        db.availability.where("presetId").equals(presetId).toArray(),
        db.solutions.where("presetId").equals(presetId).toArray(),
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
    });
  },

  saveAll: async () => {
    const presetId = get().presetId ?? (await getActivePresetId());
    const { input, solutions } = get();

    // presetId별로 "통째로 덮어쓰기" (단순하고 안전)
    await db.transaction("rw", db.professors, db.offerings, db.govtTraining, db.majorBlocked, db.profUnavailable, db.availability, db.solutions, async () => {
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

      await db.solutions.bulkAdd(
        solutions.map((x) => ({ ...x, presetId, createdAt: Date.now() }))
      );
    });
  },
}));
