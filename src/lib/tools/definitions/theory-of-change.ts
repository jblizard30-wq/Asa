import type { ToolDefinition } from "../schema";

export const theoryOfChangeTool: ToolDefinition = {
  id: "theory-of-change",
  name: "Theory of Change",
  category: "strategy",
  primitive: "narrative",
  stages: ["sense", "discern", "decide", "plan"],
  emits: ["assumption", "metric", "insight"],
  consumes: ["stakeholder", "insight"],
  blurb:
    "Map how ministry inputs and activities causally lead to spiritual fruit, changed lives, and long-term kingdom impact.",
  whenToUse:
    "Planning complex outreach initiatives, presbytery or grant reporting, or clarifying discipleship progression.",
  churchExample:
    "Mapping an ESL & refugee hospitality ministry from initial volunteers to gospel fluency and church integration.",
  estimatedMinutes: 50,
  facilitationNotes:
    "Work backward from the long-term impact to ensure every activity has a clear causal link to the mission.",
  config: {
    sections: [
      {
        key: "inputs",
        label: "1. Inputs & Kingdom Resources",
        prompt: "What staff time, volunteer leaders, budget, prayer support, and facility spaces are invested?",
      },
      {
        key: "activities",
        label: "2. Core Ministry Activities",
        prompt: "What recurring spiritual practices, events, teaching curricula, or pastoral interventions occur?",
      },
      {
        key: "outputs",
        label: "3. Direct Outputs & Engagement",
        prompt: "What tangible, countable measures occur (e.g. attendees, hours taught, meals served, groups hosted)?",
      },
      {
        key: "outcomes",
        label: "4. Short & Intermediate Outcomes",
        prompt: "What changes in knowledge, spiritual maturity, behavior, relationships, or convictions take root in 6-18 months?",
      },
      {
        key: "impact",
        label: "5. Long-Term Kingdom Impact",
        prompt: "What deep lasting spiritual transformation occurs across generations, families, and our local community over 3-5+ years?",
      },
    ],
  },
  starterTemplates: ["esl-outreach-impact", "youth-discipleship-pathway"],
};

