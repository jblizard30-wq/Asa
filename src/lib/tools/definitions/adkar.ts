import type { ToolDefinition } from "../schema";

export const adkarTool: ToolDefinition = {
  id: "adkar",
  name: "ADKAR Change Readiness Grid",
  category: "change",
  primitive: "table",
  stages: ["align", "execute"],
  emits: ["action", "risk"],
  consumes: ["stakeholder"],
  blurb:
    "Diagnose why an essential church transition is stalling across Awareness, Desire, Knowledge, Ability, and Reinforcement.",
  whenToUse:
    "Rolling out major organizational changes like service time adjustments, new small group structures, or new discipleship software.",
  churchExample:
    "Assessing why volunteer teachers are resistant to a new digital check-in system and discovering a gap in Ability (hands-on practice).",
  estimatedMinutes: 40,
  facilitationNotes:
    "Score each dimension from 1 to 5 for each group. The first dimension scoring ≤ 3 is your change bottleneck—focus your pastoral energy there.",
  config: {
    columns: [
      { key: "group", label: "Stakeholder / Team Group", type: "text" },
      { key: "awareness", label: "Awareness (1-5)", type: "number" },
      { key: "desire", label: "Desire (1-5)", type: "number" },
      { key: "knowledge", label: "Knowledge (1-5)", type: "number" },
      { key: "ability", label: "Ability (1-5)", type: "number" },
      { key: "reinforcement", label: "Reinforcement (1-5)", type: "number" },
      { key: "bottleneck", label: "Primary Bottleneck Dimension", type: "enum", options: ["Awareness", "Desire", "Knowledge", "Ability", "Reinforcement", "Ready / Champion"] },
      { key: "actionPlan", label: "Pastoral Action Plan", type: "text" },
    ],
  },
  starterTemplates: ["service-time-shift-readiness"],
};

