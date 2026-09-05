import type { ToolDefinition } from "../schema";

export const visionAlignmentTool: ToolDefinition = {
  id: "vision-alignment",
  name: "Vision & Mission Alignment Matrix",
  category: "strategy",
  primitive: "score",
  stages: ["decide"],
  emits: ["decision", "insight"],
  consumes: ["insight"],
  blurb:
    "Score proposed initiatives, events, or campaigns against your church's core mission pillars to prevent mission drift.",
  whenToUse:
    "Evaluating new ministry proposals, budget requests, or choosing between competing priorities during strategic planning.",
  churchExample:
    "Scoring whether to launch a coffee shop, an international mission trip, or a community tutoring center against church pillars.",
  estimatedMinutes: 35,
  facilitationNotes:
    "Review each criterion with the leadership team. Low scores in key pillars suggest either modifying the concept or letting it go.",
  config: {
    criteria: [
      { key: "biblicalFidelity", label: "Biblical Mandate & Gospel Centrality", weight: 30 },
      { key: "missionPillar", label: "Core Vision & Strategic Alignment", weight: 25 },
      { key: "communityNeed", label: "Real Parish & Community Need", weight: 15 },
      { key: "capacity", label: "Volunteer & Leadership Capacity", weight: 15 },
      { key: "sustainability", label: "Financial & Resource Stewardship", weight: 15 },
    ],
  },
  starterTemplates: ["ministry-expansion-prioritization"],
};

