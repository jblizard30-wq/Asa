import type { ToolDefinition } from "../schema";

export const ministryPortfolioTool: ToolDefinition = {
  id: "ministry-portfolio",
  name: "Ministry Portfolio Matrix",
  category: "strategy",
  primitive: "quadrant",
  stages: ["sense", "discern"],
  emits: ["insight", "action", "decision"],
  consumes: ["metric", "cost"],
  blurb: "Evaluate ministry programs across fruitfulness vs. resource intensity to prune, scale, or revitalize.",
  whenToUse: "Annual budget planning, leadership retreats, or when evaluating legacy ministries.",
  churchExample: "Deciding whether to continue a Wednesday night dinner program versus expanding home groups.",
  estimatedMinutes: 60,
  facilitationNotes: "Have leaders write all programs on cards before placing them. Separate spiritual fruitfulness from historic sentiment.",
  config: {
    axes: {
      x: { label: "Resource & Volunteer Intensity", low: "Low Drain", high: "High Drain" },
      y: { label: "Fruitfulness & Spiritual Impact", low: "Low Fruit", high: "High Fruit" },
    },
    cells: [
      { key: "scale", label: "High Impact / Low Intensity (Scale)", prompt: "High spiritual fruit with lean resources — invest and expand.", x: "low", y: "high" },
      { key: "optimize", label: "High Impact / High Intensity (Optimize)", prompt: "Essential and fruitful, but heavy drain — improve systems and train volunteers.", x: "high", y: "high" },
      { key: "monitor", label: "Low Impact / Low Intensity (Monitor)", prompt: "Low drain, modest return — maintain with low overhead or sunset gently.", x: "low", y: "low" },
      { key: "prune", label: "Low Impact / High Intensity (Prune / Re-align)", prompt: "High resource drain with minimal fruitfulness — courageously reform or retire.", x: "high", y: "low" },
    ],
    itemFields: [
      { key: "text", label: "Ministry / Program Name", type: "text", required: true },
      { key: "impact", label: "Resource Drain", type: "enum", options: ["Low", "Medium", "High"] },
    ],
  },
};

