export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI";
export type MajorType = "MAJOR" | "LIBERAL";

export interface Professor {
  id: string;
  name: string;
}

export interface CourseOffering {
  id: string;
  courseName: string;
  grade: number;
  majorType: MajorType;
  professorId: string;
  slotLength: number;         // 30분 슬롯 기준 길이
  mustBeConsecutive: boolean;
}

export interface TimeBlock {
  day: Day;
  startSlot: number;
  slotLength: number;
}

export interface Assignment {
  offeringId: string;
  block: TimeBlock;
}

export type ConflictCode =
  | "GRADE_CONFLICT"
  | "PROF_CONFLICT"
  | "GRADE_AFTERNOON_BLOCKED"
  | "MAJOR_BLOCKED_FOR_LIBERAL_DAY"
  | "PROF_UNAVAILABLE"
  | "OFFERING_UNAVAILABLE";

export interface Conflict {
  code: ConflictCode;
  message: string;
  relatedOfferingIds?: string[];
  day?: Day;
  slot?: number;
}

export interface GovtTrainingRule {
  grade: number;
  afternoonStartSlot: number;
}

export interface MajorBlockedRule {
  day: Day;
  startSlot: number;
  slotLength: number;
}

export interface ProfessorUnavailableRule {
  professorId: string;
  blocks: TimeBlock[];
}

export interface OfferingAvailability {
  offeringId: string;
  allowedBlocks: TimeBlock[];
}

export interface TimetableInput {
  professors: Professor[];
  offerings: CourseOffering[];

  govtTrainingRules: GovtTrainingRule[];
  majorBlockedRules: MajorBlockedRule[];
  professorUnavailableRules: ProfessorUnavailableRule[];

  availability: OfferingAvailability[];
}

export interface TimetableSolution {
  id: string;
  assignments: Assignment[];
  score: number;
}