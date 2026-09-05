import type { ToolDefinition } from "../schema";

export const keyPersonRiskTool: ToolDefinition = {
  id: "key-person-risk",
  name: "Key-Person Dependency Grid",
  category: "execution",
  primitive: "table",
  stages: ["discern", "plan"],
  emits: ["risk", "action"],
  consumes: ["stakeholder"],
  blurb: "Surface single-point-of-failure roles, missing SOPs, and succession gaps across church operations.",
  whenToUse: "Staff reviews, risk assessments, operational audits, and volunteer team planning.",
  churchExample: "Auditing AV production, financial reconciliations, and children's security systems.",
  estimatedMinutes: 45,
  facilitationNotes: "Be objective. The goal is to protect leaders from burnout and the church from disruption.",
  config: {
    columns: [
      { key: "role", label: "Critical Role / Function", type: "text" },
      { key: "holder", label: "Primary Holder", type: "text" },
      { key: "documented", label: "Documented SOP?", type: "enum", options: ["Yes", "Partial", "No"] },
      { key: "backupTrained", label: "Backup Trained?", type: "enum", options: ["Yes", "In Progress", "No"] },
      { key: "impact", label: "Disruption Impact (1-5)", type: "number" },
      { key: "recoveryTime", label: "Recovery Time", type: "enum", options: ["Hours", "Days", "Weeks", "Months"] },
    ],
  },
};

