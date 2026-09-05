import type { ToolDefinition } from "../schema";

export const soarTool: ToolDefinition = {
  id: "soar",
  name: "SOAR Analysis",
  category: "strategy",
  primitive: "quadrant",
  stages: ["sense", "discern", "review"],
  emits: ["insight", "metric", "action"],
  consumes: [],
  blurb: "Strengths, Opportunities, Aspirations, and Results — an appreciative-inquiry strategic framework.",
  whenToUse: "When setting vision, encouraging volunteer leaders, or presenting strategic direction to elder boards.",
  churchExample: "Discerning the 3-year vision for community groups with session and group leaders.",
  estimatedMinutes: 45,
  facilitationNotes: "Focuses on positive potential and shared aspirations rather than deficits and threats.",
  starterTemplates: ["community-groups", "missions-vision"],
  config: {
    axes: {
      x: { label: "Perspective", low: "Internal", high: "External" },
      y: { label: "Timeframe", low: "Future", high: "Present" },
    },
    cells: [
      { key: "S", label: "Strengths", prompt: "What are our greatest church/ministry strengths?", x: "low", y: "high" },
      { key: "O", label: "Opportunities", prompt: "What external possibilities best match our gifts?", x: "high", y: "high" },
      { key: "A", label: "Aspirations", prompt: "What future is God calling us toward?", x: "low", y: "low" },
      { key: "R", label: "Results", prompt: "How will we know we have succeeded (measurable fruit)?", x: "high", y: "low" },
    ],
    itemFields: [
      { key: "text", type: "text", label: "Statement", required: true },
      { key: "category", type: "text", label: "Ministry Area" },
      { key: "impact", type: "enum", label: "Impact", options: ["Low", "Medium", "High"] },
    ],
  },
};
