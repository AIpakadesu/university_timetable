import type { TimetableInput, Assignment } from "../domain/types";
import { validateAllAssignments } from "./conflicts";

export function runDemo() {
  const input: TimetableInput = {
    professors: [
      { id: "p1", name: "김교수" },
      { id: "p2", name: "박교수" },
    ],
    offerings: [
      { id: "o1", courseName: "네트워크", grade: 2, majorType: "MAJOR", professorId: "p1", slotLength: 6, mustBeConsecutive: true },
      { id: "o2", courseName: "회로이론", grade: 2, majorType: "MAJOR", professorId: "p2", slotLength: 6, mustBeConsecutive: true },
      { id: "o3", courseName: "데이터통신", grade: 3, majorType: "MAJOR", professorId: "p1", slotLength: 6, mustBeConsecutive: true },
    ],
    govtTrainingRules: [{ grade: 2, afternoonStartSlot: 8 }],
    majorBlockedRules: [{ day: "WED", startSlot: 0, slotLength: 18 }],
    professorUnavailableRules: [{ professorId: "p2", blocks: [{ day: "MON", startSlot: 0, slotLength: 6 }] }],
    availability: [],
  };

  const assignments: Assignment[] = [
    { offeringId: "o1", block: { day: "MON", startSlot: 8, slotLength: 6 } },
    { offeringId: "o2", block: { day: "MON", startSlot: 0, slotLength: 6 } },
    { offeringId: "o3", block: { day: "MON", startSlot: 0, slotLength: 6 } },
  ];

  const conflicts = validateAllAssignments(input, assignments);
  console.log("DEMO conflicts:", conflicts);
}