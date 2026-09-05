import { getToolDefinition } from "./registry";
import type { Stage, ToolDefinition } from "./schema";

export interface StageInfo {
  stage: Stage;
  label: string;
  question: string;
  exitCondition: string;
  color: string;
}

export const STAGE_DEFINITIONS: Record<Stage, StageInfo> = {
  sense: {
    stage: "sense",
    label: "Sense",
    question: "Something seems off or promising. Is it real?",
    exitCondition: "A named problem or opportunity with evidence",
    color: "bg-amber-100 text-amber-900 border-amber-300",
  },
  discern: {
    stage: "discern",
    label: "Discern",
    question: "What is actually going on?",
    exitCondition: "Root cause understood; stakeholders mapped",
    color: "bg-purple-100 text-purple-900 border-purple-300",
  },
  decide: {
    stage: "decide",
    label: "Decide",
    question: "Which path?",
    exitCondition: "A logged decision with rejected alternatives",
    color: "bg-blue-100 text-blue-900 border-blue-300",
  },
  align: {
    stage: "align",
    label: "Align",
    question: "Who needs to be with us, and are they?",
    exitCondition: "Key stakeholders informed; ADKAR bottleneck addressed",
    color: "bg-indigo-100 text-indigo-900 border-indigo-300",
  },
  plan: {
    stage: "plan",
    label: "Plan",
    question: "Who does what by when?",
    exitCondition: "Charter signed, RACI complete, milestones set",
    color: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  execute: {
    stage: "execute",
    label: "Execute",
    question: "Are we on track?",
    exitCondition: "Milestones met or consciously changed",
    color: "bg-sky-100 text-sky-900 border-sky-300",
  },
  review: {
    stage: "review",
    label: "Review",
    question: "What did we learn?",
    exitCondition: "AAR complete; insights and risks captured",
    color: "bg-rose-100 text-rose-900 border-rose-300",
  },
};

/**
 * Matrix B: maps each Stage to its primary recommended tool IDs and optional tool IDs.
 */
export const STAGE_RECOMMENDED_TOOL_IDS: Record<
  Stage,
  { primary: string[]; optional: string[] }
> = {
  sense: {
    primary: [
      "swot",
      "soar",
      "pestle",
      "ministry-portfolio",
      "facility-utilization",
      "volunteer-pipeline",
      "budget-variance",
    ],
    optional: ["org-chart"],
  },
  discern: {
    primary: [
      "swot",
      "soar",
      "pestle",
      "ministry-portfolio",
      "facility-utilization",
      "volunteer-pipeline",
      "budget-variance",
      "five-whys",
      "fishbone",
      "stakeholder-grid",
      "theory-of-change",
    ],
    optional: ["org-chart", "key-person-risk"],
  },
  decide: {
    primary: [
      "theory-of-change",
      "decision-matrix",
      "tco",
      "break-even",
      "vision-alignment",
    ],
    optional: ["force-field"],
  },
  align: {
    primary: [
      "stakeholder-grid",
      "force-field",
      "adkar",
      "communication-plan",
      "kotter",
    ],
    optional: ["org-chart"],
  },
  plan: {
    primary: [
      "theory-of-change",
      "tco",
      "communication-plan",
      "project-charter",
      "raci",
      "wbs",
      "swimlane",
      "pre-mortem",
      "milestones",
      "balanced-scorecard",
    ],
    optional: ["key-person-risk", "sipoc"],
  },
  execute: {
    primary: [
      "adkar",
      "communication-plan",
      "kotter",
      "raci",
      "milestones",
      "balanced-scorecard",
      "budget-variance",
    ],
    optional: ["key-person-risk"],
  },
  review: {
    primary: [
      "swot",
      "soar",
      "volunteer-pipeline",
      "budget-variance",
      "five-whys",
      "fishbone",
      "balanced-scorecard",
      "aar",
    ],
    optional: ["sipoc"],
  },
};

/**
 * Pure function: given an initiative stage and existing tool instance IDs,
 * returns missing primary and optional recommended tools.
 */
export function getRecommendedToolsForStage(
  stage: Stage,
  existingToolIds: string[] = []
): {
  primary: ToolDefinition[];
  optional: ToolDefinition[];
  missingPrimary: ToolDefinition[];
} {
  const mapping = STAGE_RECOMMENDED_TOOL_IDS[stage] || { primary: [], optional: [] };
  const existingSet = new Set(existingToolIds);

  const primary = mapping.primary
    .map((id) => getToolDefinition(id))
    .filter((t): t is ToolDefinition => t !== undefined);

  const optional = mapping.optional
    .map((id) => getToolDefinition(id))
    .filter((t): t is ToolDefinition => t !== undefined);

  const missingPrimary = primary.filter((t) => !existingSet.has(t.id));

  return {
    primary,
    optional,
    missingPrimary,
  };
}

