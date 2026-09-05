import type { ToolDefinition } from "../schema";

export const pestleTool: ToolDefinition = {
  id: "pestle",
  name: "PESTLE Environmental Scan",
  category: "strategy",
  primitive: "buckets",
  stages: ["sense", "discern"],
  emits: ["risk", "insight"],
  consumes: ["insight"],
  blurb:
    "Analyze macro-environmental trends affecting your parish: community demographics, local economy, zoning, and technology.",
  whenToUse:
    "Start of a multi-year vision cycle, before planting a new campus, or when assessing community demographic shifts.",
  churchExample:
    "Scanning neighborhood shifts in housing costs, school calendars, and zoning before launching a family outreach center.",
  estimatedMinutes: 45,
  facilitationNotes:
    "Gather elders, pastoral staff, and neighborhood liaisons. Examine external data and census trends before filling buckets.",
  config: {
    categories: [
      {
        key: "political",
        label: "🏛️ Civic & Parish Governance",
        prompt: "Local municipal policies, school district partnerships, neighborhood associations, and zoning rules.",
      },
      {
        key: "economic",
        label: "💼 Economic & Employment Trends",
        prompt: "Local job market shifts, cost of living, household income changes, and economic pressures on families.",
      },
      {
        key: "social",
        label: "👥 Social & Demographic Shifts",
        prompt: "Age distributions, family structures, ethnic diversity, and cultural attitudes toward church and faith in your city.",
      },
      {
        key: "technological",
        label: "💻 Technological & Communication",
        prompt: "How people discover community, digital habits, hybrid attendance expectations, and tech platforms.",
      },
      {
        key: "legal",
        label: "⚖️ Legal & Regulatory Realities",
        prompt: "Child protection standards, nonprofit compliance, property permits, and local safety ordinances.",
      },
      {
        key: "environmental",
        label: "🌱 Physical & Environmental Context",
        prompt: "Traffic corridors, parking availability, weather impacts, neighborhood density, and facility constraints.",
      },
    ],
    itemFields: [
      { key: "text", type: "text", label: "Observation or Trend", required: true },
      { key: "evidence", type: "text", label: "Supporting Data or Source" },
      { key: "impact", type: "enum", label: "Ministry Impact", options: ["High", "Medium", "Low"] },
    ],
  },
  starterTemplates: ["suburban-parish-scan", "urban-campus-assessment"],
};

