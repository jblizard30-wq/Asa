import type { ToolDefinition } from "../schema";

export const swimlaneTool: ToolDefinition = {
  id: "swimlane",
  name: "Cross-Functional Role Swimlane",
  category: "execution",
  primitive: "flow",
  stages: ["plan"],
  emits: ["action"],
  consumes: ["stakeholder"],
  blurb:
    "Map chronological workflows across ministry roles: Elders, Pastoral Staff, Operations, Volunteer Teams, and Congregation.",
  whenToUse:
    "Mapping complex handoffs during multi-team operations like Sunday morning baptism services, funeral coordination, or weddings.",
  churchExample:
    "Mapping baptism Sunday handoffs: Pastoral interview -> elder approval -> tank prep -> candidate briefing -> photography -> certificate delivery.",
  estimatedMinutes: 40,
  facilitationNotes:
    "Identify where steps cross between lanes—hand-off boundaries are where communication breakdowns most frequently occur.",
  config: {
    lanes: [
      { key: "session", label: "Session / Elder Board" },
      { key: "pastoral", label: "Pastoral & Teaching Staff" },
      { key: "ops", label: "Operations & Facilities" },
      { key: "volunteers", label: "Volunteer Ministry Teams" },
      { key: "congregation", label: "Candidates / Families" },
    ],
    nodeFields: [
      { key: "timing", type: "text", label: "Timing / Trigger" },
      { key: "checklist", type: "text", label: "Handoff Requirements" },
    ],
  },
  starterTemplates: ["sunday-baptism-service-swimlane"],
};

