import type { ToolDefinition } from "../schema";

export const forceFieldTool: ToolDefinition = {
  id: "force-field",
  name: "Ministry Force Field Analysis",
  category: "strategy",
  primitive: "buckets",
  stages: ["align", "plan"],
  emits: ["risk", "action", "insight"],
  consumes: ["stakeholder"],
  blurb: "Analyze driving forces pushing a vision forward vs. restraining forces causing resistance or inertia.",
  whenToUse: "When an essential ministry transition is stalling or meeting congregational resistance.",
  churchExample: "Transitioning adult education from Sunday School lectures into midweek missional small groups.",
  estimatedMinutes: 45,
  facilitationNotes: "Progress occurs fastest by weakening restraining forces rather than just increasing driving pressure.",
  config: {
    categories: [
      { key: "driving", label: "Driving Forces (Pushing Forward)", prompt: "Spiritual urgency, demographic shifts, elder leadership, positive momentum." },
      { key: "restraining", label: "Restraining Forces (Resisting Change)", prompt: "Fear of the unknown, tradition/nostalgia, lack of training, volunteer fatigue." },
    ],
    itemFields: [
      { key: "text", label: "Force Description", type: "text", required: true },
      { key: "impact", label: "Force Strength", type: "enum", options: ["Low", "Medium", "High"] },
    ],
  },
};

