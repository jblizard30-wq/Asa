import type { ToolDefinition } from "../schema";

export const swotTool: ToolDefinition = {
  id: "swot",
  name: "SWOT Analysis",
  category: "strategy",
  primitive: "quadrant",
  stages: ["sense", "discern", "review"],
  emits: ["insight", "risk", "action"],
  consumes: ["metric"],
  blurb: "Take stock of where a ministry actually stands before planning its next season.",
  whenToUse: "Start of a planning cycle, before a major change, or when a ministry has plateaued.",
  churchExample: "Evaluating the youth ministry before hiring a new director.",
  estimatedMinutes: 45,
  facilitationNotes: "Best with 4-8 people. Do Strengths first, it warms the room.",
  starterTemplates: ["youth-ministry", "facilities", "giving-health"],
  config: {
    axes: {
      x: { label: "Origin", low: "Internal", high: "External" },
      y: { label: "Valence", low: "Unhelpful", high: "Helpful" },
    },
    cells: [
      { key: "S", label: "Strengths", prompt: "What do we do well that others notice?", x: "low", y: "high" },
      { key: "W", label: "Weaknesses", prompt: "Where do we consistently fall short?", x: "low", y: "low" },
      { key: "O", label: "Opportunities", prompt: "What is changing around us that we could meet?", x: "high", y: "high" },
      { key: "T", label: "Threats", prompt: "What outside pressure could hurt us in 24 months?", x: "high", y: "low" },
    ],
    itemFields: [
      { key: "text", type: "text", label: "Description", required: true },
      { key: "evidence", type: "text", label: "What makes you say that?" },
      { key: "impact", type: "enum", label: "Impact", options: ["Low", "Medium", "High"] },
      { key: "owner", type: "person", label: "Owner" },
    ],
  },
};
