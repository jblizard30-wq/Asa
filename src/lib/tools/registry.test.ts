import { describe, it, expect } from "vitest";
import { getToolDefinition, listToolDefinitions } from "./registry";
import { ToolDefinitionSchema, dataSchemaFor } from "./schema";
import {
  getRecommendedToolsForStage,
  STAGE_DEFINITIONS,
  STAGE_RECOMMENDED_TOOL_IDS,
} from "./stageRecommendations";

describe("tool registry and schema", () => {
  it("registers all 30 tools conforming to ToolDefinitionSchema", () => {
    const list = listToolDefinitions();
    expect(list.length).toBe(30);

    const expectedIds = [
      "raci",
      "swot",
      "soar",
      "ministry-portfolio",
      "key-person-risk",
      "project-charter",
      "stakeholder-grid",
      "force-field",
      "volunteer-pipeline",
      "pre-mortem",
      "decision-matrix",
      "aar",
      "org-chart",
      "pestle",
      "theory-of-change",
      "balanced-scorecard",
      "vision-alignment",
      "tco",
      "adkar",
      "communication-plan",
      "kotter",
      "milestones",
      "swimlane",
      "wbs",
      "five-whys",
      "fishbone",
      "sipoc",
      "budget-variance",
      "break-even",
      "facility-utilization",
    ];

    for (const id of expectedIds) {
      const tool = getToolDefinition(id);
      expect(tool, `Tool ${id} must be defined`).toBeDefined();
      const validated = ToolDefinitionSchema.safeParse(tool);
      expect(validated.success, `Tool "${id}" failed schema validation`).toBe(true);
    }
  });

  it("returns undefined for unknown tool IDs", () => {
    expect(getToolDefinition("non-existent-tool")).toBeUndefined();
  });

  it("produces a valid Zod schema via dataSchemaFor", () => {
    const raci = getToolDefinition("raci")!;
    const schema = dataSchemaFor(raci);
    expect(schema).toBeDefined();

    // Validate table shape
    const validData = {
      rows: [
        { id: "1", step: "Plan service", responsible: "Lead", accountable: "Pastor" },
      ],
    };
    expect(schema.safeParse(validData).success).toBe(true);
  });
});

describe("stage recommendations engine (Matrix B)", () => {
  it("provides stage definitions and lookup metadata for all 7 stages", () => {
    const stages = ["sense", "discern", "decide", "align", "plan", "execute", "review"] as const;
    for (const stage of stages) {
      expect(STAGE_DEFINITIONS[stage]).toBeDefined();
      expect(STAGE_DEFINITIONS[stage].question.length).toBeGreaterThan(0);
      expect(STAGE_DEFINITIONS[stage].exitCondition.length).toBeGreaterThan(0);
      expect(STAGE_RECOMMENDED_TOOL_IDS[stage].primary.length).toBeGreaterThan(0);
    }
  });

  it("calculates missing primary recommendations given existing instances", () => {
    const recs = getRecommendedToolsForStage("plan", ["raci", "project-charter"]);
    expect(recs.primary.length).toBeGreaterThan(0);
    expect(recs.missingPrimary.some((t) => t.id === "raci")).toBe(false);
    expect(recs.missingPrimary.some((t) => t.id === "project-charter")).toBe(false);
    expect(recs.missingPrimary.some((t) => t.id === "milestones")).toBe(true);
  });
});
