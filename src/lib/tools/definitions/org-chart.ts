import type { ToolDefinition } from "../schema";

export const orgChartTool: ToolDefinition = {
  id: "org-chart",
  name: "Church Organizational Hierarchy & Staff Structure",
  category: "strategy",
  primitive: "tree",
  stages: ["discern", "plan", "align"],
  emits: ["stakeholder", "action"],
  consumes: [],
  blurb: "Build and visualize church staff, elder governance, diaconate, and volunteer ministry reporting structures.",
  whenToUse: "Staff restructurings, hiring plans, annual governance reviews, or new campus team launches.",
  churchExample: "Mapping the reporting hierarchy from Elder Board -> Senior Pastor -> Executive Pastor -> Directors -> Ministry Team Leads.",
  estimatedMinutes: 45,
  facilitationNotes: "Clearly distinguish between governing authority (Elders), management (Executive Pastor), and volunteer team coordinators.",
  config: {
    rootLabel: "Elder Board / Session",
    nodeFields: [
      { key: "personName", label: "Person Name", type: "text", required: true },
      { key: "roleTitle", label: "Role / Title", type: "text", required: true },
      { key: "ministryArea", label: "Ministry Area", type: "enum", options: ["Pastoral", "Worship", "Youth", "Children", "Operations", "Diaconate", "Discipleship"] },
    ],
  },
};

