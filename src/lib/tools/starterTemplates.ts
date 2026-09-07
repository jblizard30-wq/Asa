/**
 * Church Starter Templates for CPCana Strategic Frameworks
 * Pre-populates realistic ministry scenarios so users never start with blank canvases.
 */

export function getStarterDataForTool(toolId: string): unknown {
  switch (toolId) {
    case 'swot':
      return {
        items: [
          {
            id: 'swot-1',
            cellKey: 'strengths',
            values: { text: 'Deeply committed diaconal team and volunteer nursery care network', impact: 'High' },
          },
          {
            id: 'swot-2',
            cellKey: 'strengths',
            values: { text: 'Robust expositional preaching and liturgical worship tradition', impact: 'High' },
          },
          {
            id: 'swot-3',
            cellKey: 'weaknesses',
            values: { text: 'Aging campus HVAC and soundboard tech requiring frequent weekend fixes', impact: 'High' },
          },
          {
            id: 'swot-4',
            cellKey: 'weaknesses',
            values: { text: 'Youth ministry parent onboarding pathway has communication gaps', impact: 'Medium' },
          },
          {
            id: 'swot-5',
            cellKey: 'opportunities',
            values: { text: 'Suburban family growth along corridor seeking community discipleship', impact: 'High' },
          },
          {
            id: 'swot-6',
            cellKey: 'opportunities',
            values: { text: 'Partnership with regional mercy ministry for food pantry distribution', impact: 'Medium' },
          },
          {
            id: 'swot-7',
            cellKey: 'threats',
            values: { text: 'Seasonal summer giving dip causing Q3 cash flow strain', impact: 'Critical' },
          },
          {
            id: 'swot-8',
            cellKey: 'threats',
            values: { text: 'Key volunteer burnout across tech and hospitality rosters', impact: 'High' },
          },
        ],
      };

    case 'soar':
      return {
        items: [
          {
            id: 'soar-1',
            cellKey: 'strengths',
            values: { text: 'Generous congregational giving history and low facility debt', impact: 'High' },
          },
          {
            id: 'soar-2',
            cellKey: 'opportunities',
            values: { text: 'Establish mid-week community dinner & biblical theology cohorts', impact: 'High' },
          },
          {
            id: 'soar-3',
            cellKey: 'aspirations',
            values: { text: 'Every covenant member actively connected to a gospel community group', impact: 'High' },
          },
          {
            id: 'soar-4',
            cellKey: 'results',
            values: { text: '150 adults in weekly community groups and 20 new small-group leaders trained', impact: 'Critical' },
          },
        ],
      };

    case 'eisenhower':
      return {
        items: [
          {
            id: 'eisen-1',
            cellKey: 'do',
            values: { text: 'Sunday worship bulletin and liturgy print order deadline (Thursday noon)', impact: 'Critical' },
          },
          {
            id: 'eisen-2',
            cellKey: 'do',
            values: { text: 'Resolve nursery check-in iPad printer sync failure before Sunday', impact: 'High' },
          },
          {
            id: 'eisen-3',
            cellKey: 'schedule',
            values: { text: 'Draft 2027 fiscal year operating budget line review with Finance Committee', impact: 'High' },
          },
          {
            id: 'eisen-4',
            cellKey: 'schedule',
            values: { text: 'Complete annual staff performance and compensation reviews', impact: 'Medium' },
          },
          {
            id: 'eisen-5',
            cellKey: 'delegate',
            values: { text: 'Fellowship hall coffee supply restocking and urn maintenance', impact: 'Low' },
          },
          {
            id: 'eisen-6',
            cellKey: 'eliminate',
            values: { text: 'Discontinue obsolete printed monthly bulletin inserts with <5% scan rate', impact: 'Low' },
          },
        ],
      };

    case 'stop-start-continue':
      return {
        items: [
          {
            id: 'ssc-1',
            categoryKey: 'stop',
            values: { text: 'Manual paper reimbursement forms lacking receipt photos', impact: 'High' },
          },
          {
            id: 'ssc-2',
            categoryKey: 'start',
            values: { text: 'Digital ministry expense approval directly through CPCana tasks', impact: 'High' },
          },
          {
            id: 'ssc-3',
            categoryKey: 'start',
            values: { text: 'Monthly elder pastoral prayer rotation during Wednesday evening prayer', impact: 'Medium' },
          },
          {
            id: 'ssc-4',
            categoryKey: 'continue',
            values: { text: 'Weekly Monday morning staff standup and liturgy coordination review', impact: 'Critical' },
          },
          {
            id: 'ssc-5',
            categoryKey: 'continue',
            values: { text: 'Seasonal new member inquirer seminars with pastor Q&A', impact: 'High' },
          },
        ],
      };

    case 'three-horizons':
      return {
        items: [
          {
            id: 'th-1',
            categoryKey: 'horizon1',
            values: { text: 'Stabilize Sunday worship volunteer coverage and bulletin turnaround', impact: 'High' },
          },
          {
            id: 'th-2',
            categoryKey: 'horizon1',
            values: { text: 'Quarterly budget variance reviews and elder board packet distribution', impact: 'High' },
          },
          {
            id: 'th-3',
            categoryKey: 'horizon2',
            values: { text: 'Launch pastoral residency cohort & lay theological training institute', impact: 'High' },
          },
          {
            id: 'th-4',
            categoryKey: 'horizon3',
            values: { text: 'Plant daughter church in west county development corridor within 4 years', impact: 'Critical' },
          },
        ],
      };

    case 'darci':
      return {
        rows: [
          {
            id: 'darci-1',
            deliverable: 'Sunday Worship Service Execution',
            driver: 'Director of Worship',
            approver: 'Senior Pastor',
            responsible: 'Tech Team, Choir, Greeters',
            consulted: 'Executive Pastor',
            informed: 'Session / Elders',
          },
          {
            id: 'darci-2',
            deliverable: 'Annual Ministry Budget Approval',
            driver: 'Executive Pastor',
            approver: 'Session / Elder Board',
            responsible: 'Finance Committee, Ministry Directors',
            consulted: 'Treasurer, Diaconate Lead',
            informed: 'Congregation at Annual Meeting',
          },
          {
            id: 'darci-3',
            deliverable: 'Campus Capital Renovation',
            driver: 'Facilities Manager',
            approver: 'Diaconate & Trustees',
            responsible: 'General Contractor, Subcontractors',
            consulted: 'Senior Pastor, Office Manager',
            informed: 'All Church Staff',
          },
        ],
      };

    case 'risk-register':
    case 'risk-matrix':
      return {
        rows: [
          {
            id: 'risk-1',
            risk: 'Child Check-in System Outage on Easter Sunday',
            category: 'Safety & Tech',
            likelihood: 'Low',
            impact: 'Critical',
            mitigation: 'Offline paper roster backup binders pre-printed by Saturday 5pm',
            owner: 'Childrens Director',
          },
          {
            id: 'risk-2',
            risk: 'HVAC Failure in Sanctuary During Summer Worship',
            category: 'Facilities',
            likelihood: 'Medium',
            impact: 'High',
            mitigation: 'Preventive maintenance contract with 2-hour emergency response SLA',
            owner: 'Facilities Lead',
          },
          {
            id: 'risk-3',
            risk: 'Solo-knowledge reliance on office bookkeeping specialist',
            category: 'Governance & Staffing',
            likelihood: 'High',
            impact: 'High',
            mitigation: 'Cross-train assistant administrator on weekly payroll & offering reconciliation',
            owner: 'Executive Pastor',
          },
        ],
      };

    case 'decision-matrix':
      return {
        options: [
          {
            id: 'opt-1',
            label: 'Option A: Planning Center Suite (PCO)',
            scores: { theological_fit: 8, ease_of_use: 9, volunteer_adoption: 9, total_cost: 7, data_portability: 8 },
          },
          {
            id: 'opt-2',
            label: 'Option B: Pushpay / CCB All-in-One',
            scores: { theological_fit: 7, ease_of_use: 8, volunteer_adoption: 7, total_cost: 5, data_portability: 7 },
          },
          {
            id: 'opt-3',
            label: 'Option C: Lightweight Modular Tooling',
            scores: { theological_fit: 9, ease_of_use: 8, volunteer_adoption: 8, total_cost: 9, data_portability: 9 },
          },
        ],
      };

    case 'problem-statement':
      return {
        sections: {
          context: 'Chesterfield Presbyterian Church has experienced 15% growth in Sunday attendance over the past 18 months, with many young families joining the covenant community.',
          problem: 'Nursery and children\'s check-in spaces are experiencing severe lobby bottlenecks between Sunday School and the 10:30 AM service, causing stress for young parents and security risks.',
          impact: 'Visitors feel overwhelmed, first-time families report feeling disoriented, and Sunday morning volunteer coordinators spend 45 minutes managing line control instead of welcoming members.',
          objective: 'Design and deploy a redesigned double-kiosk check-in layout and mobile pre-check workflow that reduces average check-in wait time to under 45 seconds by November 1.',
        },
      };

    case 'one-page-strategy':
      return {
        sections: {
          core_mission: 'To glorify God through faithful Reformed exposition, gospel-centered worship, and sacrificial diaconal mercy in our community.',
          thematic_goal: 'Cultivate Deep Discipleship & Intergenerational Fellowship Across All Ministries.',
          defining_objectives: '1. Launch 10 new community groups\n2. Establish Elder pastoral prayer cohorts\n3. Restructure children\'s volunteer rotations to prevent burnout',
          operating_standards: 'Confessional fidelity, joyful hospitality, financial transparency, and member pastoral care.',
        },
      };

    case 'org-chart':
      return {
        root: {
          id: 'root',
          label: 'Session / Elder Board',
          values: { personName: 'Session / Elder Board', roleTitle: 'Governing Authority', ministryArea: 'Governance' },
          children: [
            {
              id: 'node-sp',
              label: 'Senior Pastor',
              values: { personName: 'Senior Pastor', roleTitle: 'Preaching & Spiritual Oversight', ministryArea: 'Pastoral' },
              children: [
                {
                  id: 'node-xp',
                  label: 'Executive Pastor',
                  values: { personName: 'Executive Pastor', roleTitle: 'Operations, Budget & Staff Oversight', ministryArea: 'Operations' },
                  children: [
                    {
                      id: 'node-worship',
                      label: 'Worship & Liturgy Director',
                      values: { personName: 'Worship Director', roleTitle: 'Music, Liturgy & AV Tech', ministryArea: 'Worship' },
                      children: [],
                    },
                    {
                      id: 'node-kids',
                      label: 'Children & Family Director',
                      values: { personName: 'Children Director', roleTitle: 'Nursery through 5th Grade', ministryArea: 'Family' },
                      children: [],
                    },
                    {
                      id: 'node-youth',
                      label: 'Student Ministries Director',
                      values: { personName: 'Youth Director', roleTitle: 'Middle & High School Ministry', ministryArea: 'Students' },
                      children: [],
                    },
                    {
                      id: 'node-admin',
                      label: 'Church Administrator',
                      values: { personName: 'Office Administrator', roleTitle: 'Office, Calendar & Facility Scheduling', ministryArea: 'Administration' },
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              id: 'node-diaconate',
              label: 'Board of Deacons',
              values: { personName: 'Diaconate Lead', roleTitle: 'Mercy Ministry & Campus Stewardship', ministryArea: 'Mercy' },
              children: [],
            },
          ],
        },
      };

    case 'discipleship-pathway':
    case 'volunteer-pipeline':
      return {
        nodes: [
          {
            id: 'node-1',
            label: 'Sunday Morning Guest / Inquirer',
            order: 0,
            values: { text: 'Attends Sunday worship liturgy & receives welcome gift', headcount: 60 },
          },
          {
            id: 'node-2',
            label: 'Inquirer Seminar & Pastor Meetup',
            order: 1,
            values: { text: 'Attends 3-week covenant theology & church life class', headcount: 25 },
          },
          {
            id: 'node-3',
            label: 'Communicant Membership Interview',
            order: 2,
            values: { text: 'Elder session interview and testimony affirmation', headcount: 20 },
          },
          {
            id: 'node-4',
            label: 'Community Group & Ministry Service Placement',
            order: 3,
            values: { text: 'Active in small group and serves on a Sunday morning rotation team', headcount: 18 },
          },
          {
            id: 'node-5',
            label: 'Lay Leadership & Officer Nominations',
            order: 4,
            values: { text: 'Undergoes elder/deacon officer training and mentoring', headcount: 6 },
          },
        ],
      };

    default:
      return null;
  }
}

export function getDefaultDataForPrimitive(primitive: string, config?: unknown): unknown {
  switch (primitive) {
    case 'quadrant':
    case 'buckets':
      return { items: [] };
    case 'table':
      return { rows: [] };
    case 'narrative': {
      const sections: Record<string, string> = {};
      const cfg = config as { sections?: Array<{ key: string }> };
      if (cfg?.sections) {
        for (const s of cfg.sections) {
          sections[s.key] = '';
        }
      }
      return { sections };
    }
    case 'flow':
      return { nodes: [] };
    case 'score':
      return { options: [] };
    case 'tree': {
      const cfg = config as { rootLabel?: string };
      return {
        root: {
          id: 'root',
          label: cfg?.rootLabel || 'Session / Elder Board',
          values: { personName: 'Session / Elder Board', roleTitle: 'Governing Authority' },
          children: [],
        },
      };
    }
    default:
      return {};
  }
}
