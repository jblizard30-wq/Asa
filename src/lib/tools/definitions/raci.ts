import type { ToolDefinition } from "../schema";

export const raciTool: ToolDefinition = {
  id: "raci",
  name: "RACI Matrix",
  category: "execution",
  primitive: "table",
  stages: ["plan", "execute"],
  emits: ["action"],
  consumes: ["stakeholder"],
  blurb: "Map who is Responsible, Accountable, Consulted, and Informed for each step of a process.",
  whenToUse: "When clarifying ownership across multiple roles, defining recurring workflows, or eliminating coverage gaps.",
  churchExample: "Event booked in eSpace — host and tech coverage assigned across pastors and volunteers.",
  estimatedMinutes: 30,
  facilitationNotes: "Ensure exactly one person is marked Accountable (A) per step. Having zero or multiple creates ambiguity.",
  starterTemplates: ["room-booking", "employee-onboarding", "change-approval"],
  config: {
    columns: [
      { key: "step", label: "Step / Task", type: "text" },
      { key: "responsible", label: "Responsible (R)", type: "person" },
      { key: "accountable", label: "Accountable (A)", type: "person" },
      { key: "consulted", label: "Consulted (C)", type: "person" },
      { key: "informed", label: "Informed (I)", type: "person" },
    ],
  },
};

