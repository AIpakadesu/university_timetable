export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI";
export type MajorType = "MAJOR" | "LIBERAL";

export type Professor = {
  id: string;
  name: string;
  targetHours: number; // ✅ 교수 목표 시수(채워야 하는 시수)
};

export type CourseOffering = {
  id: string;
  courseName: string;
  grade: number;
  majorType: MajorType;
  professorId: string;
  slotLength: number; // ✅ 1시간 단위 (예: 3 = 3시간)
  mustBeConsecutive: boolean;
};

export type GovtTrainingRule = {
  grade: number;
  afternoonStartSlot: number; // (09시 시작 기준 13시는 4)
};

export type MajorBlockedRule = {
  day: Day;
  startSlot: number;
  slotLength: number;
};

export type TimeBlock = {
  day: Day;
  startSlot: number;
  slotLength: number;
};

export type LunchRule = TimeBlock; // ✅ 전체 공통 불가(점심시간)

export type ProfessorUnavailableRule = {
  professorId: string;
  blocks: TimeBlock[]; // ✅ 교수 불가시간(보통 slotLength=1)
};

export type OfferingAvailability = {
  offeringId: string;
  allowedBlocks: TimeBlock[]; // ✅ 과목 희망(가능) 시작시간 목록
};

export type Assignment = {
  offeringId: string;
  block: TimeBlock;
};

export type Conflict = {
  code:
    | "OFFERING_UNAVAILABLE"
    | "GRADE_AFTERNOON_BLOCKED"
    | "MAJOR_BLOCKED_FOR_LIBERAL_DAY"
    | "PROF_UNAVAILABLE"
    | "GRADE_CONFLICT"
    | "PROF_CONFLICT"
    | "LUNCH_BLOCKED";
  message: string;
  day?: Day;
  slot?: number;
  relatedOfferingIds?: string[];
};

export type TimetableSolution = {
  id: string;
  name: string;
  assignments: Assignment[];
};

export type TimetableInput = {
  professors: Professor[];
  offerings: CourseOffering[];

  // ✅ 초기 설정 탭에서 관리
  lunchRules: LunchRule[];
  govtTrainingRules: GovtTrainingRule[];
  majorBlockedRules: MajorBlockedRule[];

  // ✅ 희망시간 탭에서 관리
  professorUnavailableRules: ProfessorUnavailableRule[];
  availability: OfferingAvailability[];
};