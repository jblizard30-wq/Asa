import type { ToolDefinition } from "../schema";

export const communicationPlanTool: ToolDefinition = {
  id: "communication-plan",
  name: "Ministry Communication Matrix",
  category: "change",
  primitive: "table",
  stages: ["align", "plan", "execute"],
  emits: ["action"],
  consumes: ["stakeholder"],
  blurb:
    "Plan who needs to hear what message, through which church channel, from whom, and when.",
  whenToUse:
    "Coordinating campaign announcements, pastoral transitions, building renovations, or seasonal event promotions.",
  churchExample:
    "Mapping announcements for a capital stewardship campaign across pulpit, member letter, congregational meeting, and small group leaders.",
  estimatedMinutes: 35,
  facilitationNotes:
    "Sequence communications deliberately: inform key leadership and affected groups in personal settings before making broad pulpit announcements.",
  config: {
    columns: [
      { key: "audience", label: "Target Audience", type: "text" },
      { key: "keyMessage", label: "Core Pastoral Message", type: "text" },
      {
        key: "channel",
        label: "Communication Channel",
        type: "enum",
        options: [
          "Personal 1:1 / Meeting",
          "Session / Elder Docket",
          "Sunday Pulpit / Stage",
          "Member Email / Pastoral Letter",
          "Printed Bulletin & Lobby Signs",
          "Small Group Leaders",
          "Church App / Text Notification",
        ],
      },
      { key: "timing", label: "Timing / Date / Cadence", type: "text" },
      { key: "owner", label: "Lead Messenger / Owner", type: "person" },
      { key: "status", label: "Status", type: "enum", options: ["Drafting", "Approved", "Delivered / Completed"] },
    ],
  },
  starterTemplates: ["capital-campaign-communication-matrix"],
};

