import type {
  Assignment,
  Conflict,
  CourseOffering,
  TimetableInput,
  TimeBlock,
  MajorBlockedRule,
  ProfessorUnavailableRule,
} from "../domain/types";

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

function blockOverlapsBlock(a: TimeBlock, b: TimeBlock) {
  if (a.day !== b.day) return false;
  return overlaps(a.startSlot, a.slotLength, b.startSlot, b.slotLength);
}

function isAfternoon(startSlot: number, afternoonStartSlot: number) {
  return startSlot >= afternoonStartSlot;
}

function isWithin(rule: MajorBlockedRule, block: TimeBlock) {
  if (rule.day !== block.day) return false;
  return overlaps(rule.startSlot, rule.slotLength, block.startSlot, block.slotLength);
}

function getOfferingMap(offerings: CourseOffering[]) {
  return new Map(offerings.map((o) => [o.id, o]));
}

function getProfessorUnavailMap(rules: ProfessorUnavailableRule[]) {
  return new Map(rules.map((r) => [r.professorId, r.blocks]));
}

function getAvailabilityMap(input: TimetableInput) {
  return new Map(input.availability.map((a) => [a.offeringId, a.allowedBlocks]));
}

export function checkConflictsForPlacement(
  input: TimetableInput,
  current: Assignment[],
  next: Assignment
): Conflict[] {
  const conflicts: Conflict[] = [];

  const offeringMap = getOfferingMap(input.offerings);
  const profUnavailMap = getProfessorUnavailMap(input.professorUnavailableRules);
  const availabilityMap = getAvailabilityMap(input);

  const nextOffering = offeringMap.get(next.offeringId);
  if (!nextOffering) {
    conflicts.push({ code: "OFFERING_UNAVAILABLE", message: "해당 과목 정보를 찾을 수 없습니다." });
    return conflicts;
  }

  // (1) 과목별 allowedBlocks 제한(있을 때만)
  const allowedBlocks = availabilityMap.get(next.offeringId);
  if (allowedBlocks && allowedBlocks.length > 0) {
    const ok = allowedBlocks.some(
      (b) =>
        b.day === next.block.day &&
        b.startSlot === next.block.startSlot &&
        b.slotLength === next.block.slotLength
    );
    if (!ok) {
      conflicts.push({
        code: "OFFERING_UNAVAILABLE",
        message: "이 과목은 해당 시간에 배치할 수 없습니다(희망/가능 시간 범위 밖).",
        day: next.block.day,
        slot: next.block.startSlot,
      });
    }
  }

  // (2) 국비교육 학년 오후 불가
  const govtRule = input.govtTrainingRules.find((r) => r.grade === nextOffering.grade);
  if (govtRule && isAfternoon(next.block.startSlot, govtRule.afternoonStartSlot)) {
    conflicts.push({
      code: "GRADE_AFTERNOON_BLOCKED",
      message: `${nextOffering.grade}학년은 국비교육으로 인해 오후 수업 배치가 불가합니다.`,
      day: next.block.day,
      slot: next.block.startSlot,
    });
  }

  // (3) 교양 운영으로 전공 배치 불가 시간
  if (nextOffering.majorType === "MAJOR") {
    for (const rule of input.majorBlockedRules) {
      if (isWithin(rule, next.block)) {
        conflicts.push({
          code: "MAJOR_BLOCKED_FOR_LIBERAL_DAY",
          message: "교양 운영으로 해당 시간에는 전공 과목 배치가 불가합니다.",
          day: next.block.day,
          slot: next.block.startSlot,
        });
        break;
      }
    }
  }

  // (4) 교수 개인 불가 시간
  const unavailBlocks = profUnavailMap.get(nextOffering.professorId) ?? [];
  if (unavailBlocks.some((b) => blockOverlapsBlock(b, next.block))) {
    conflicts.push({
      code: "PROF_UNAVAILABLE",
      message: "교수님의 불가 시간입니다.",
      day: next.block.day,
      slot: next.block.startSlot,
    });
  }

  // (5) 학년 겹침 + 교수 겹침
  const gradeConflicts: string[] = [];
  const profConflicts: string[] = [];

  for (const a of current) {
    const aOffering = offeringMap.get(a.offeringId);
    if (!aOffering) continue;

    if (a.block.day !== next.block.day) continue;
    if (!overlaps(a.block.startSlot, a.block.slotLength, next.block.startSlot, next.block.slotLength)) continue;

    if (aOffering.grade === nextOffering.grade) gradeConflicts.push(aOffering.id);
    if (aOffering.professorId === nextOffering.professorId) profConflicts.push(aOffering.id);
  }

  if (gradeConflicts.length > 0) {
    conflicts.push({
      code: "GRADE_CONFLICT",
      message: `${nextOffering.grade}학년 시간표가 겹칩니다.`,
      relatedOfferingIds: gradeConflicts,
      day: next.block.day,
      slot: next.block.startSlot,
    });
  }

  if (profConflicts.length > 0) {
    conflicts.push({
      code: "PROF_CONFLICT",
      message: "동일 교수님의 강의 시간이 겹칩니다.",
      relatedOfferingIds: profConflicts,
      day: next.block.day,
      slot: next.block.startSlot,
    });
  }

  return conflicts;
}

export function validateAllAssignments(input: TimetableInput, assignments: Assignment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const current: Assignment[] = [];
  for (const a of assignments) {
    conflicts.push(...checkConflictsForPlacement(input, current, a));
    current.push(a);
  }
  return conflicts;
}