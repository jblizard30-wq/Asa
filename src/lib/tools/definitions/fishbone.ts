import type { ToolDefinition } from "../schema";

export const fishboneTool: ToolDefinition = {
  id: "fishbone",
  name: "Fishbone Cause & Effect Analysis",
  category: "improvement",
  primitive: "tree",
  stages: ["discern", "review"],
  emits: ["insight", "action"],
  consumes: ["risk"],
  blurb:
    "Systematically explore root causes across 6 church dimensions: People, Process, Facilities, Technology, Communication, and Budget.",
  whenToUse:
    "Diagnosing multi-faceted operational issues like declining small group attendance, AV livestream issues, or summer attendance slumps.",
  churchExample:
    "Analyzing why youth group attendance dropped 30% across leaders, schedule conflicts, bus transportation, and parent communication.",
  estimatedMinutes: 45,
  facilitationNotes:
    "Brainstorm factors under each branch without rushing to solutions immediately. Group similar themes before prioritizing fixes.",
  config: {
    nodeFields: [
      {
        key: "branchCategory",
        type: "enum",
        label: "Category Branch",
        options: [
          "👥 People & Leadership",
          "🔄 Process & Execution",
          "🏛️ Facilities & Space",
          "💻 Technology & Equipment",
          "📢 Communication & Clarity",
          "💰 Budget & Stewardship",
        ],
      },
      { key: "impact", type: "enum", label: "Estimated Contribution", options: ["High", "Medium", "Low"] },
    ],
  },
  starterTemplates: ["youth-attendance-drop-diagnosis"],
};

