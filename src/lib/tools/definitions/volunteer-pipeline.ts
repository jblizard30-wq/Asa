import type { ToolDefinition } from "../schema";

export const volunteerPipelineTool: ToolDefinition = {
  id: "volunteer-pipeline",
  name: "Volunteer Discipleship & Leadership Pipeline",
  category: "execution",
  primitive: "flow",
  stages: ["sense", "review"],
  emits: ["insight", "action"],
  consumes: ["metric"],
  blurb: "Map the spiritual pathway from first-time guest to mature volunteer server and ministry leader.",
  whenToUse: "Volunteer recruitment reviews, discipleship pathway evaluations, and team staffing.",
  churchExample: "Auditing why Sunday hospitality has 50 greeters but Student Ministry has no small group leaders.",
  estimatedMinutes: 45,
  facilitationNotes: "Look for the sharpest drop-off between steps — that represents your ministry's primary discipleship bottleneck.",
  config: {
    lanes: [
      { key: "engagement", label: "Congregational Engagement" },
      { key: "serving", label: "Active Ministry Service" },
      { key: "leadership", label: "Multiplying Leadership" },
    ],
    nodeFields: [
      { key: "text", label: "Pathway Step", type: "text", required: true },
      { key: "headcount", label: "Active Headcount", type: "number" },
      { key: "notes", label: "Action Required", type: "text" },
    ],
  },
};

