import type { ToolDefinition } from "../schema";

export const budgetVarianceTool: ToolDefinition = {
  id: "budget-variance",
  name: "Ministry Budget Variance Analysis",
  category: "improvement",
  primitive: "table",
  stages: ["sense", "discern", "execute", "review"],
  emits: ["risk", "insight", "cost"],
  consumes: ["metric", "cost"],
  blurb:
    "Track budgeted vs. actual spending across functional church ministry areas to maintain financial stewardship and detect overages early.",
  whenToUse:
    "Monthly finance committee reviews, quarterly elder board updates, and year-end budget reconciliation.",
  churchExample:
    "Tracking children's curriculum expenses, worship AVL maintenance, and outreach food pantry costs against approved annual allocations.",
  estimatedMinutes: 35,
  facilitationNotes:
    "Categorize by functional nonprofit areas (Worship, Discipleship, Mercy & Care, Operations). Highlight any variance > 10% for session review.",
  config: {
    columns: [
      {
        key: "ministryArea",
        label: "Ministry / Expense Category",
        type: "enum",
        options: [
          "Pastoral & Staff Compensation",
          "Worship & Tech Production",
          "Children & Family Discipleship",
          "Student & Youth Ministry",
          "Missions & Global Outreach",
          "Diaconal Care & Benevolence",
          "Facilities & Utilities",
          "Administration & Operations",
        ],
      },
      { key: "annualBudget", label: "Approved Annual Budget ($)", type: "number" },
      { key: "ytdActual", label: "YTD Actual Spend ($)", type: "number" },
      { key: "varianceAmount", label: "Variance Amount ($)", type: "number" },
      { key: "variancePercent", label: "Variance (%)", type: "text" },
      { key: "status", label: "Budget Health", type: "enum", options: ["Under Budget", "On Track", "Over Budget / Watch", "Critical Overage"] },
      { key: "explanation", label: "Explanation & Pastoral Context", type: "text" },
    ],
  },
  starterTemplates: ["annual-ministry-budget-review"],
};

