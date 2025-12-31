import type { Assignment, Day, TimetableInput, TimeBlock } from "../domain/types";
import { checkConflictsForPlacement } from "./conflicts";

const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI"];

export function getAllowedBlocks(input: TimetableInput, offeringId: string): TimeBlock[] | null {
  const row = input.availability.find((a) => a.offeringId === offeringId);
  if (!row) return null;
  return row.allowedBlocks ?? [];
}

/**
 * offeringId를 특정 시간에 배치하려 할 때, 충돌 없는 대체 시작시간을 최대 max개 추천
 * - 현재 배치(current)에서 offeringId는 제거한 상태로 평가하는 것을 권장
 */
export function suggestAlternatives(args: {
  input: TimetableInput;
  current: Assignment[];
  offeringId: string;
  config: { startHour: number; endHour: number; slotMinutes: number };
  max?: number;
}): TimeBlock[] {
  const { input, current, offeringId, config, max = 3 } = args;

  const offering = input.offerings.find((o) => o.id === offeringId);
  if (!offering) return [];

  const slotsPerHour = 60 / config.slotMinutes;
  const totalSlots = (config.endHour - config.startHour) * slotsPerHour;

  const allowed = getAllowedBlocks(input, offeringId);
  const allowedSet = allowed
    ? new Set(allowed.map((b) => `${b.day}-${b.startSlot}-${b.slotLength}`))
    : null;

  const candidates: TimeBlock[] = [];

  for (const day of DAYS) {
    for (let startSlot = 0; startSlot + offering.slotLength <= totalSlots; startSlot++) {
      const block: TimeBlock = { day, startSlot, slotLength: offering.slotLength };

      // allowedBlocks가 설정되어 있으면 그 안에서만 추천
      if (allowedSet && !allowedSet.has(`${day}-${startSlot}-${offering.slotLength}`)) continue;

      const test: Assignment = { offeringId, block };
      const conflicts = checkConflictsForPlacement(input, current, test);
      if (conflicts.length === 0) candidates.push(block);

      if (candidates.length >= max) return candidates;
    }
  }

  return candidates;
}