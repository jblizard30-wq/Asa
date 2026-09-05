import type { ToolDefinition } from "../schema";

export const stakeholderGridTool: ToolDefinition = {
  id: "stakeholder-grid",
  name: "Church Stakeholder Power & Interest Grid",
  category: "strategy",
  primitive: "quadrant",
  stages: ["discern", "align"],
  emits: ["stakeholder", "action"],
  consumes: [],
  blurb: "Map influence and direct impact across elders, staff, deacons, legacy members, and new attenders.",
  whenToUse: "Prior to major transitions, governance changes, capital campaigns, or service time shifts.",
  churchExample: "Mapping congregational stakeholder groups prior to announcing a building expansion.",
  estimatedMinutes: 45,
  facilitationNotes: "Focus on shepherding communication pathways. Treat all groups with pastoral care.",
  config: {
    axes: {
      x: { label: "Congregational Influence & Governance Power", low: "Low Influence", high: "High Influence" },
      y: { label: "Direct Impact & Daily Interest", low: "Low Impact", high: "High Impact" },
    },
    cells: [
      { key: "manageClosely", label: "High Power / High Interest (Manage Closely)", prompt: "Engage actively, consult pastorally, seek direct buy-in (e.g. Session, pastoral staff).", x: "high", y: "high" },
      { key: "keepSatisfied", label: "High Power / Low Interest (Keep Satisfied)", prompt: "Keep informed, respect authority, prevent surprises (e.g. Trustees, Founding Elders, Presbytery).", x: "high", y: "low" },
      { key: "keepInformed", label: "Low Power / High Interest (Keep Informed)", prompt: "Communicate clearly, shepherd relationally (e.g. Volunteer servers, parents, young families).", x: "low", y: "high" },
      { key: "monitor", label: "Low Power / Low Interest (Monitor)", prompt: "General announcements via bulletin and newsletter (e.g. Casual attenders, community neighbors).", x: "low", y: "low" },
    ],
    itemFields: [
      { key: "text", label: "Stakeholder Group / Name", type: "text", required: true },
      { key: "impact", label: "Priority Channel", type: "enum", options: ["Pulpit", "Personal Meeting", "Email / Letter", "Town Hall", "Bulletin"] },
    ],
  },
};

