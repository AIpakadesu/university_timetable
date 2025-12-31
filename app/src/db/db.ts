import Dexie, { type Table } from "dexie";
import type {
  Professor,
  CourseOffering,
  GovtTrainingRule,
  MajorBlockedRule,
  ProfessorUnavailableRule,
  OfferingAvailability,
  TimetableSolution,
  Assignment,
  LunchRule,
} from "../domain/types";

export interface AppMeta {
  key: "ACTIVE_PRESET_ID" | "MAX_GRADE";
  value: string;
}

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfessorRow extends Professor {
  presetId: string;
}
export interface OfferingRow extends CourseOffering {
  presetId: string;
}
export interface GovtTrainingRow extends GovtTrainingRule {
  presetId: string;
}
export interface MajorBlockedRow extends MajorBlockedRule {
  presetId: string;
}
export interface LunchRow extends LunchRule {
  presetId: string;
}

export interface ProfUnavailableRow extends ProfessorUnavailableRule {
  presetId: string;
}
export interface AvailabilityRow extends OfferingAvailability {
  presetId: string;
}

export interface SolutionRow extends TimetableSolution {
  presetId: string;
  createdAt: number;
}

export interface DraftRow {
  presetId: string;
  assignments: Assignment[];
  updatedAt: number;
}

export class TimetableDB extends Dexie {
  presets!: Table<Preset, string>;
  meta!: Table<AppMeta, string>;

  professors!: Table<ProfessorRow, string>;
  offerings!: Table<OfferingRow, string>;
  govtTraining!: Table<GovtTrainingRow, number>;
  majorBlocked!: Table<MajorBlockedRow, number>;
  lunch!: Table<LunchRow, number>;

  profUnavailable!: Table<ProfUnavailableRow, number>;
  availability!: Table<AvailabilityRow, string>;

  solutions!: Table<SolutionRow, string>;
  drafts!: Table<DraftRow, string>;

  constructor() {
    super("university_timetable_db");

    this.version(1).stores({
      presets: "id, updatedAt",
      meta: "key",

      professors: "id, presetId",
      offerings: "id, presetId",

      govtTraining: "++id, presetId",
      majorBlocked: "++id, presetId",

      profUnavailable: "++id, presetId",
      availability: "offeringId, presetId",
      solutions: "id, presetId, createdAt",
    });

    this.version(2).stores({
      drafts: "presetId",
    });

    this.version(3).stores({
      lunch: "++id, presetId",
    });
  }
}

export const db = new TimetableDB();