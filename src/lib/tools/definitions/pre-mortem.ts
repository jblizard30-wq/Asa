import type { ToolDefinition } from "../schema";

export const preMortemTool: ToolDefinition = {
  id: "pre-mortem",
  name: "Ministry Pre-Mortem Risk Analysis",
  category: "execution",
  primitive: "buckets",
  stages: ["plan", "discern"],
  emits: ["risk", "assumption", "action"],
  consumes: [],
  blurb: "Assume the future initiative has completely failed 18 months out, and uncover the hidden causes now.",
  whenToUse: "Before launching capital campaigns, campus plants, major events, or new ministry programs.",
  churchExample: "Uncovering blind spots before launching an off-site campus or new third Sunday service.",
  estimatedMinutes: 50,
  facilitationNotes: "Give full psychological safety to staff and volunteers. No objection is 'disloyal' in a pre-mortem.",
  config: {
    categories: [
      { key: "people", label: "People & Leadership", prompt: "Volunteer burnout, key staff turnover, lack of qualified team leads." },
      { key: "money", label: "Financial & Giving", prompt: "Giving shortfall, unexpected cost overruns, donor fatigue." },
      { key: "communication", label: "Communication & Clarity", prompt: "Congregation confusion, mixed messaging, rumor mills, unreached families." },
      { key: "facility", label: "Facility & Operations", prompt: "Zoning issues, parking overflow, child safety bottlenecks, tech failures." },
      { key: "timing", label: "Timing & External", prompt: "School calendar conflicts, community events, holiday fatigue." },
    ],
    itemFields: [
      { key: "text", label: "Failure Scenario", type: "text", required: true },
      { key: "impact", label: "Severity", type: "enum", options: ["Low", "Medium", "High", "Critical"] },
    ],
  },
};

