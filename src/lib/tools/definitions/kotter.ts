import type { ToolDefinition } from "../schema";

export const kotterTool: ToolDefinition = {
  id: "kotter",
  name: "Kotter 8-Step Change Tracker",
  category: "change",
  primitive: "flow",
  stages: ["align", "execute"],
  emits: ["action"],
  consumes: ["stakeholder"],
  blurb:
    "Track church transformation through John Kotter's 8 essential stages of change leadership.",
  whenToUse:
    "Major multi-month church transitions: planting a campus, restructuring ministry departments, or adopting a new governance model.",
  churchExample:
    "Leading the congregation through adopting a refreshed statement of mission and community small-group model.",
  estimatedMinutes: 40,
  facilitationNotes:
    "Do not skip stages (especially Stage 1 Urgency and Stage 2 Guiding Coalition). Prematurely declaring victory before Stage 8 leads to regression.",
  config: {
    lanes: [
      { key: "climate", label: "Creating the Climate for Change (Steps 1-3)" },
      { key: "engaging", label: "Engaging & Enabling the Whole Church (Steps 4-6)" },
      { key: "implementing", label: "Implementing & Sustaining Change (Steps 7-8)" },
    ],
    nodeFields: [
      { key: "status", type: "enum", label: "Progress Status", options: ["Not Started", "In Progress", "Achieved", "Needs Reinforcement"] },
      { key: "evidence", type: "text", label: "Evidence of Completion / Fruit" },
      { key: "owner", type: "person", label: "Lead Champion" },
    ],
  },
  starterTemplates: ["church-restructure-change-flow"],
};

