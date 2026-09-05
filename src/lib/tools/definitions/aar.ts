import type { ToolDefinition } from "../schema";

export const aarTool: ToolDefinition = {
  id: "aar",
  name: "After-Action Review (AAR)",
  category: "execution",
  primitive: "narrative",
  stages: ["review"],
  emits: ["insight", "action", "risk"],
  consumes: ["metric"],
  blurb: "Debrief seasonal events, capital campaigns, Easter, Christmas Eve, or VBS to capture institutional wisdom.",
  whenToUse: "Within 72 hours of completing any major church milestone, seasonal event, or outreach.",
  churchExample: "Debriefing Vacation Bible School (VBS) or Easter Sunday logistics and volunteer experience.",
  estimatedMinutes: 45,
  facilitationNotes: "Focus on learning and systemic improvement rather than assigning personal blame.",
  config: {
    sections: [
      { key: "intent", label: "1. What was our original intent and plan?", prompt: "What were the intended outcomes, attendance expectations, and schedule?" },
      { key: "reality", label: "2. What actually occurred?", prompt: "What happened on the ground? What were the real numbers and volunteer realities?" },
      { key: "difference", label: "3. Why was there a difference between plan and reality?", prompt: "What unforeseen variables, weather, staffing gaps, or communication issues arose?" },
      { key: "sustain", label: "4. What should we SUSTAIN next time?", prompt: "What worked exceptionally well and must be repeated?" },
      { key: "improve", label: "5. What should we IMPROVE or STOP?", prompt: "What drained energy or failed to deliver and should be modified or abandoned?" },
    ],
  },
};

