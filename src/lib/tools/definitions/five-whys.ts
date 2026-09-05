import type { ToolDefinition } from "../schema";

export const fiveWhysTool: ToolDefinition = {
  id: "five-whys",
  name: "5 Whys Root Cause Analysis",
  category: "improvement",
  primitive: "tree",
  stages: ["discern", "review"],
  emits: ["insight", "action"],
  consumes: ["risk"],
  blurb:
    "Drill beneath surface symptoms by asking 'Why?' five times to discover the systemic or cultural root cause of a ministry problem.",
  whenToUse:
    "Investigating chronic ministry frustrations, recurring Sunday morning breakdowns, or volunteer retention drops.",
  churchExample:
    "Why was nursery check-in delayed 20 minutes? -> Why did printers fail? -> Why was paper out? -> Why is inventory unassigned? -> Root cause: No steward for classroom supplies.",
  estimatedMinutes: 30,
  facilitationNotes:
    "Keep asking why to find process or training gaps rather than placing personal blame on individuals.",
  config: {
    nodeFields: [
      { key: "category", type: "enum", label: "Diagnostic Level", options: ["1. Observed Symptom", "2. Direct Cause", "3. Process Gap", "4. Policy/Training Deficit", "5. Core Root Cause"] },
      { key: "countermeasure", type: "text", label: "Proposed Systemic Countermeasure" },
    ],
  },
  starterTemplates: ["sunday-nursery-checkin-breakdown"],
};

