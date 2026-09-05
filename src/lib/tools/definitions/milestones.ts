import type { ToolDefinition } from "../schema";

export const milestonesTool: ToolDefinition = {
  id: "milestones",
  name: "Ministry Milestone Timeline",
  category: "execution",
  primitive: "flow",
  stages: ["plan", "execute"],
  emits: ["action"],
  consumes: ["action", "stakeholder"],
  blurb:
    "Organize major campaign deliverables, key target dates, and launch sequences without heavy project management overhead.",
  whenToUse:
    "Planning holiday seasons (Easter/Christmas), summer VBS, fall kickoff, building projects, or ordination exams.",
  churchExample:
    "Coordinating 12-week milestones for summer Vacation Bible School: volunteer recruitment -> curriculum review -> stage build -> event kickoff.",
  estimatedMinutes: 35,
  facilitationNotes:
    "Anchor key deadlines to fixed calendar dates (e.g. Easter Sunday). Work backward to establish lead times for ordering materials and safety training.",
  config: {
    lanes: [
      { key: "prep", label: "1. Phase 1: Preparation & Procurement" },
      { key: "build", label: "2. Phase 2: Volunteer Training & Rehearsals" },
      { key: "launch", label: "3. Phase 3: Launch & Execution" },
      { key: "debrief", label: "4. Phase 4: Follow-up & Celebration" },
    ],
    nodeFields: [
      { key: "targetDate", type: "text", label: "Target Date / Deadline", required: true },
      { key: "owner", type: "person", label: "Accountable Lead" },
      { key: "status", type: "enum", label: "Status", options: ["Scheduled", "On Track", "Delayed", "Completed"] },
    ],
  },
  starterTemplates: ["vbs-12-week-launch-timeline"],
};

