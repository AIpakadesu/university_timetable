import Dexie, { type Table } from "dexie";
import type {
  Professor,
  CourseOffering,
  GovtTrainingRule,
  MajorBlockedRule,
  ProfessorUnavailableRule,
  OfferingAvailability,
  TimetableSolution,
} from "../domain/types";

export interface AppMeta {
  key: "ACTIVE_PRESET_ID";
  value: string;
}

export interface Preset {
  id: string;          // preset id
  name: string;        // 표시 이름 (예: "2026-1 기본")
  createdAt: number;
  updatedAt: number;
}

/**
 * presetId로 모든 데이터를 묶어서 저장합니다.
 * 이유: 프리셋 기능(요구사항 6번)을 "DB 레벨"에서 깔끔하게 처리 가능
 */
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
  }
}

export const db = new TimetableDB();
