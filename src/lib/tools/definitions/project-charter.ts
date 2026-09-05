import type { ToolDefinition } from "../schema";

export const projectCharterTool: ToolDefinition = {
  id: "project-charter",
  name: "Session & Ministry Initiative Charter",
  category: "execution",
  primitive: "narrative",
  stages: ["plan"],
  emits: ["decision", "stakeholder", "cost", "action"],
  consumes: ["metric"],
  blurb: "Structure scope, missional mandate, budget, non-goals, and stakeholder sign-off before launching a major initiative.",
  whenToUse: "Before capital projects, hiring campaigns, campus launches, or new ministry programs.",
  churchExample: "Chartering a church-wide facility renovation and building safety overhaul.",
  estimatedMinutes: 60,
  facilitationNotes: "Pay special attention to 'Non-Goals (Out of Scope)' to prevent ministry drift and scope creep.",
  config: {
    sections: [
      { key: "mandate", label: "Biblical & Missional Mandate", prompt: "Why is God calling our church to undertake this initiative in this season?" },
      { key: "scope", label: "Scope & Core Deliverables", prompt: "What specific outcomes and tangible results will this initiative deliver?" },
      { key: "outOfScope", label: "Non-Goals (Out of Scope)", prompt: "What are we explicitly NOT doing to protect our focus and resources?" },
      { key: "budget", label: "Budget & Capital Requirements", prompt: "What financial, staff, and facility resources are allocated?" },
      { key: "stakeholders", label: "Sponsor, Leaders & Approvers", prompt: "Who is the lead champion, executive pastor sponsor, and elder sign-off?" },
      { key: "constraints", label: "Key Deadlines & Constraints", prompt: "What fixed dates (e.g. Easter, Fall Kickoff) or bylaws bound this effort?" },
    ],
  },
};

