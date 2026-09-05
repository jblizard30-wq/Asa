import type { ToolDefinition } from "../schema";

export const tcoTool: ToolDefinition = {
  id: "tco",
  name: "TCO & Cost-Benefit Analysis",
  category: "decisions",
  primitive: "table",
  stages: ["decide", "plan"],
  emits: ["cost", "assumption"],
  consumes: ["cost"],
  blurb:
    "Evaluate multi-year total cost of ownership including capital setup, recurring software fees, payment transaction cuts, and staff training.",
  whenToUse:
    "Evaluating major vendor contracts, Church Management Systems, HVAC/facility capital investments, or digital giving platforms.",
  churchExample:
    "Comparing Pushpay vs. Planning Center Giving including monthly SaaS fees, ACH rates, and credit card processing charges.",
  estimatedMinutes: 40,
  facilitationNotes:
    "Look beyond the Year 1 sticker price. Factor in staff setup hours, volunteer onboarding, and transaction percentages.",
  config: {
    columns: [
      { key: "solution", label: "Option / Vendor / Item", type: "text" },
      { key: "upfrontSetup", label: "Upfront Setup & Hardware ($)", type: "number" },
      { key: "year1Annual", label: "Year 1 Recurring SaaS / Maint ($)", type: "number" },
      { key: "transactionFeeRate", label: "Estimated Processing / Variable ($)", type: "number" },
      { key: "staffTrainingHours", label: "Staff Onboarding / Training (Hours)", type: "number" },
      { key: "threeYearTotal", label: "Estimated 3-Yr TCO ($)", type: "number" },
      { key: "recommendation", label: "Recommendation / Verdict", type: "enum", options: ["Strong Contender", "Viable Alternative", "Over Budget / Non-Viable"] },
    ],
  },
  starterTemplates: ["digital-giving-tco-comparison"],
};

