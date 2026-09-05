import type { ToolDefinition } from "../schema";

export const decisionMatrixTool: ToolDefinition = {
  id: "decision-matrix",
  name: "ChMS & Vendor Decision Matrix",
  category: "decisions",
  primitive: "score",
  stages: ["decide"],
  emits: ["decision"],
  consumes: ["cost"],
  blurb: "Multi-criteria weighted scoring to objectively compare vendors, ChMS software, giving platforms, or curriculum.",
  whenToUse: "Selecting church management systems (Planning Center, Pushpay, Breeze), AV packages, insurance, or curriculum.",
  churchExample: "Evaluating church management software options against volunteer usability, giving fees, and database migration.",
  estimatedMinutes: 45,
  facilitationNotes: "Agree on the criteria weights with stakeholders BEFORE entering individual vendor scores.",
  config: {
    criteria: [
      { key: "usability", label: "Volunteer Usability", weight: 30 },
      { key: "features", label: "Ministry Features & Mobile App", weight: 25 },
      { key: "pricing", label: "Total Cost & Transaction Fees", weight: 20 },
      { key: "migration", label: "Migration & Support Ease", weight: 15 },
      { key: "security", label: "Child Check-in & Security", weight: 10 },
    ],
  },
};

