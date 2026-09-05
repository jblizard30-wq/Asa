import type { ToolDefinition } from "../schema";

export const sipocTool: ToolDefinition = {
  id: "sipoc",
  name: "SIPOC Process Framework",
  category: "improvement",
  primitive: "table",
  stages: ["plan", "review"],
  emits: ["insight", "stakeholder"],
  consumes: ["stakeholder"],
  blurb:
    "Clarify high-level boundaries of a ministry process: Suppliers, Inputs, Process Steps, Outputs, and Customers/Congregation.",
  whenToUse:
    "Standardizing major cross-departmental operations like new member assimilation, benevolence requests, or baptism logistics.",
  churchExample:
    "Mapping the Benevolence Ministry from Applicant (Supplier) -> Financial Records (Input) -> Deacon Review (Process) -> Relief Check & Prayer (Output) -> Family in Need (Customer).",
  estimatedMinutes: 40,
  facilitationNotes:
    "Start by defining the Process boundaries (start and finish) before identifying the Suppliers and Customers.",
  config: {
    columns: [
      { key: "supplier", label: "Suppliers (Who provides inputs?)", type: "text" },
      { key: "input", label: "Inputs (What materials/info are needed?)", type: "text" },
      { key: "processStep", label: "Core Process Step", type: "text" },
      { key: "output", label: "Outputs (What product/deliverable is produced?)", type: "text" },
      { key: "customer", label: "Recipient / Congregation (Who receives the output?)", type: "text" },
    ],
  },
  starterTemplates: ["deacon-benevolence-process-sipoc"],
};

