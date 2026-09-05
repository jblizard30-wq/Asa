import type { ToolDefinition } from "./schema";
import { raciTool } from "./definitions/raci";
import { swotTool } from "./definitions/swot";
import { soarTool } from "./definitions/soar";
import { ministryPortfolioTool } from "./definitions/ministry-portfolio";
import { keyPersonRiskTool } from "./definitions/key-person-risk";
import { projectCharterTool } from "./definitions/project-charter";
import { stakeholderGridTool } from "./definitions/stakeholder-grid";
import { forceFieldTool } from "./definitions/force-field";
import { volunteerPipelineTool } from "./definitions/volunteer-pipeline";
import { preMortemTool } from "./definitions/pre-mortem";
import { decisionMatrixTool } from "./definitions/decision-matrix";
import { aarTool } from "./definitions/aar";
import { orgChartTool } from "./definitions/org-chart";
import { pestleTool } from "./definitions/pestle";
import { theoryOfChangeTool } from "./definitions/theory-of-change";
import { balancedScorecardTool } from "./definitions/balanced-scorecard";
import { visionAlignmentTool } from "./definitions/vision-alignment";
import { tcoTool } from "./definitions/tco";
import { adkarTool } from "./definitions/adkar";
import { communicationPlanTool } from "./definitions/communication-plan";
import { kotterTool } from "./definitions/kotter";
import { milestonesTool } from "./definitions/milestones";
import { swimlaneTool } from "./definitions/swimlane";
import { wbsTool } from "./definitions/wbs";
import { fiveWhysTool } from "./definitions/five-whys";
import { fishboneTool } from "./definitions/fishbone";
import { sipocTool } from "./definitions/sipoc";
import { budgetVarianceTool } from "./definitions/budget-variance";
import { breakEvenTool } from "./definitions/break-even";
import { facilityUtilizationTool } from "./definitions/facility-utilization";

/**
 * One entry per tool. Adding a tool (TOOLKIT-SPEC.md Section 2) means adding a file
 * under `./definitions/` and one line here — nothing else.
 */
const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  [raciTool.id]: raciTool,
  [swotTool.id]: swotTool,
  [soarTool.id]: soarTool,
  [ministryPortfolioTool.id]: ministryPortfolioTool,
  [keyPersonRiskTool.id]: keyPersonRiskTool,
  [projectCharterTool.id]: projectCharterTool,
  [stakeholderGridTool.id]: stakeholderGridTool,
  [forceFieldTool.id]: forceFieldTool,
  [volunteerPipelineTool.id]: volunteerPipelineTool,
  [preMortemTool.id]: preMortemTool,
  [decisionMatrixTool.id]: decisionMatrixTool,
  [aarTool.id]: aarTool,
  [orgChartTool.id]: orgChartTool,
  [pestleTool.id]: pestleTool,
  [theoryOfChangeTool.id]: theoryOfChangeTool,
  [balancedScorecardTool.id]: balancedScorecardTool,
  [visionAlignmentTool.id]: visionAlignmentTool,
  [tcoTool.id]: tcoTool,
  [adkarTool.id]: adkarTool,
  [communicationPlanTool.id]: communicationPlanTool,
  [kotterTool.id]: kotterTool,
  [milestonesTool.id]: milestonesTool,
  [swimlaneTool.id]: swimlaneTool,
  [wbsTool.id]: wbsTool,
  [fiveWhysTool.id]: fiveWhysTool,
  [fishboneTool.id]: fishboneTool,
  [sipocTool.id]: sipocTool,
  [budgetVarianceTool.id]: budgetVarianceTool,
  [breakEvenTool.id]: breakEvenTool,
  [facilityUtilizationTool.id]: facilityUtilizationTool,
};

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[id];
}

export function listToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY);
}
