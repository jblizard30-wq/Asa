import type { ToolDefinition } from "../schema";

export const facilityUtilizationTool: ToolDefinition = {
  id: "facility-utilization",
  name: "Facility & Space Utilization Grid",
  category: "improvement",
  primitive: "table",
  stages: ["sense", "discern"],
  emits: ["metric", "insight", "cost"],
  consumes: ["cost"],
  blurb:
    "Evaluate physical room usage across sanctuary, fellowship hall, classrooms, and youth rooms by time block to resolve spatial bottlenecks.",
  whenToUse:
    "Planning additional worship service times, launching mid-week programs, or preparing building expansion campaigns.",
  churchExample:
    "Evaluating whether the 3rd-grade Sunday school room and sanctuary balcony have reached the 80% full threshold triggering new service times.",
  estimatedMinutes: 35,
  facilitationNotes:
    "Rooms feeling > 80% full create an invisible psychological barrier to guests. Combine with eSpace or calendar check-in data.",
  config: {
    columns: [
      {
        key: "room",
        label: "Facility Space / Room",
        type: "enum",
        options: [
          "Main Sanctuary / Worship Center",
          "Fellowship Hall / Multi-Purpose",
          "Nursery & Toddler Rooms",
          "Children's Classrooms (K-5th)",
          "Youth Room / Student Center",
          "Church Offices & Conference Room",
          "Kitchen & Hospitality Area",
        ],
      },
      {
        key: "timeBlock",
        label: "Time Block",
        type: "enum",
        options: [
          "Sunday Morning (8:00 AM - 1:00 PM)",
          "Sunday Evening (5:00 PM - 8:00 PM)",
          "Wednesday Evening Mid-week",
          "Weekday Daytime (Mon-Fri 9-5)",
          "Weekday Evening (Mon-Thu 6-9)",
          "Saturday Morning / Event",
        ],
      },
      { key: "primaryMinistry", label: "Primary Ministry User", type: "text" },
      { key: "capacity", label: "Room Seating Capacity", type: "number" },
      { key: "avgAttendance", label: "Average Attendance", type: "number" },
      { key: "utilizationPercent", label: "Utilization (%)", type: "text" },
      { key: "status", label: "Capacity Status", type: "enum", options: ["Underutilized (<50%)", "Optimal (50-80%)", "Near Capacity (80-95%)", "Overcrowded (>95%)"] },
    ],
  },
  starterTemplates: ["sunday-facility-capacity-audit"],
};

