import type { ToolDefinition } from "../schema";

export const balancedScorecardTool: ToolDefinition = {
  id: "balanced-scorecard",
  name: "Balanced Ministry Scorecard",
  category: "improvement",
  primitive: "table",
  stages: ["plan", "execute", "review"],
  emits: ["action", "metric", "insight"],
  consumes: ["metric"],
  blurb:
    "Evaluate ministry health across four holistic dimensions: spiritual vitality, stewardship, internal processes, and leadership development.",
  whenToUse:
    "Annual board retreats, executive staff KPI tracking, and quarterly whole-church health reviews.",
  churchExample:
    "Tracking congregational baptism rates, giving trends, volunteer background check compliance, and elder apprentice pipeline.",
  estimatedMinutes: 45,
  facilitationNotes:
    "Resist the temptation to only track attendance and dollars. Weight spiritual formation and volunteer health equally.",
  config: {
    columns: [
      {
        key: "perspective",
        label: "Dimension / Perspective",
        type: "enum",
        options: [
          "Congregational Health & Spiritual Fruit",
          "Financial Stewardship & Resources",
          "Internal Ministry & Operational Process",
          "Staff & Volunteer Discipleship",
        ],
      },
      { key: "objective", label: "Strategic Objective", type: "text" },
      { key: "metric", label: "Key Measure / KPI", type: "text" },
      { key: "target", label: "Target / Standard", type: "text" },
      { key: "actual", label: "Current Actual", type: "text" },
      { key: "owner", label: "Lead Shepherd / Director", type: "person" },
      { key: "status", label: "Health Status", type: "enum", options: ["Healthy", "Attention Needed", "At Risk"] },
    ],
  },
  starterTemplates: ["annual-church-health-scorecard"],
};

