import type { ToolDefinition } from "../schema";

export const wbsTool: ToolDefinition = {
  id: "wbs",
  name: "Work Breakdown Structure (WBS)",
  category: "execution",
  primitive: "tree",
  stages: ["plan"],
  emits: ["action"],
  consumes: ["stakeholder"],
  blurb:
    "Deconstruct major church projects into manageable ministry work packages, sub-teams, and deliverables.",
  whenToUse:
    "Planning large complex endeavors like building renovations, multi-campus launches, or 50th church anniversary celebrations.",
  churchExample:
    "Breaking down a Church Anniversary Weekend into Hospitality, Historical Archiving, Guest Speakers, Worship Music, and Community Outreach.",
  estimatedMinutes: 45,
  facilitationNotes:
    "Ensure the 100% rule: every sub-branch completely encompasses the parent deliverable without overlapping sibling packages.",
  config: {
    nodeFields: [
      { key: "owner", type: "person", label: "Work Package Owner" },
      { key: "estimatedCost", type: "text", label: "Estimated Budget / Cost" },
      { key: "status", type: "enum", label: "Status", options: ["Planned", "In Progress", "Complete"] },
    ],
  },
  starterTemplates: ["church-anniversary-wbs"],
};

