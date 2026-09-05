import type { ToolDefinition } from "../schema";

export const breakEvenTool: ToolDefinition = {
  id: "break-even",
  name: "Event & Retreat Break-Even Analysis",
  category: "decisions",
  primitive: "score",
  stages: ["decide"],
  emits: ["cost", "metric", "assumption"],
  consumes: ["cost"],
  blurb:
    "Calculate the financial viability and attendee threshold required for retreats, conferences, camps, and special events.",
  whenToUse:
    "Pricing ticketed church events: Men's/Women's retreats, Youth summer camp, Marriage conference, or community banquet.",
  churchExample:
    "Pricing a Marriage Weekend: Camp facility fee ($3,000) + Speaker ($1,500) with $45/person meal cost -> Break-even headcount at $120/couple.",
  estimatedMinutes: 30,
  facilitationNotes:
    "Separate fixed non-negotiable costs (camp rental, key speaker) from variable per-person costs (meals, workbooks, t-shirts).",
  config: {
    criteria: [
      { key: "facilityFixed", label: "Facility / Venue Rental ($)", weight: 25 },
      { key: "speakerFixed", label: "Speaker / Honorarium / Travel ($)", weight: 20 },
      { key: "perPersonVariable", label: "Variable Cost Per Person ($)", weight: 25 },
      { key: "ticketPrice", label: "Target Attendee Ticket Price ($)", weight: 20 },
      { key: "scholarshipSub", label: "Church Scholarship Reserve ($)", weight: 10 },
    ],
  },
  starterTemplates: ["marriage-retreat-break-even"],
};

