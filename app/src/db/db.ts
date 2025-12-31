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
} from "../domain/types";

export interface AppMeta {
  key: "ACTIVE_PRESET_ID";
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

/** ✅ 사용자가 수정 가능한 임시 배치(미리보기에서 클릭으로 조정) */
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

    // ✅ v2: drafts 추가
    this.version(2).stores({
      drafts: "presetId",
    });
  }
}

export const db = new TimetableDB();