import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Priority, TaskStatus, Role } from '@prisma/client';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function populateDemoData() {
  // 1. Ensure primary demo users exist
  const passwordHash = await bcrypt.hash('password123', 10);

  const pastor = await prisma.user.upsert({
    where: { email: 'pastor.dan@example.org' },
    update: { role: Role.ADMIN },
    create: { name: 'Pastor Dan Whitfield', email: 'pastor.dan@example.org', passwordHash, role: Role.ADMIN },
  });

  const officeManager = await prisma.user.upsert({
    where: { email: 'renee.ortiz@example.org' },
    update: { role: Role.MANAGER },
    create: { name: 'Renee Ortiz', email: 'renee.ortiz@example.org', passwordHash, role: Role.MANAGER },
  });

  const facilitiesLead = await prisma.user.upsert({
    where: { email: 'miguel.alvarez@example.org' },
    update: { role: Role.USER },
    create: { name: 'Miguel Alvarez', email: 'miguel.alvarez@example.org', passwordHash, role: Role.USER },
  });

  const youthPastor = await prisma.user.upsert({
    where: { email: 'casey.nguyen@example.org' },
    update: { role: Role.USER },
    create: { name: 'Casey Nguyen', email: 'casey.nguyen@example.org', passwordHash, role: Role.USER },
  });

  const volunteer = await prisma.user.upsert({
    where: { email: 'sarah.kim@example.org' },
    update: { role: Role.USER },
    create: { name: 'Sarah Kim', email: 'sarah.kim@example.org', passwordHash, role: Role.USER },
  });

  // 2. Teams
  async function getOrCreateTeam(name: string, managerId: string, memberIds: string[]) {
    let team = await prisma.team.findUnique({ where: { name } });
    if (!team) {
      team = await prisma.team.create({
        data: {
          name,
          managerId,
          members: { create: memberIds.map((id) => ({ userId: id })) },
        },
      });
    }
    return team;
  }

  const worshipTeam = await getOrCreateTeam('Worship & Creative Arts', pastor.id, [pastor.id, volunteer.id]);
  const facilitiesTeam = await getOrCreateTeam('Facilities & Hospitality', officeManager.id, [
    facilitiesLead.id,
    volunteer.id,
  ]);
  const careTeam = await getOrCreateTeam('Pastoral Care & Diaconate', pastor.id, [pastor.id, officeManager.id]);
  const youthTeam = await getOrCreateTeam('Youth & Family Ministries', youthPastor.id, [youthPastor.id, volunteer.id]);

  // 3. Workflows Definitions
  const workflowDefinitions = [
    {
      name: 'Sunday Worship & Liturgy Blueprint',
      description:
        'Standard weekly operating procedure covering preaching planning, AV tech staging, liturgy bulletins, and Sunday morning run-of-show.',
      isTemplate: true,
      teamId: worshipTeam.id,
      stages: [
        {
          name: 'Pre-Service Prep (Mon–Wed)',
          order: 0,
          tasks: [
            {
              title: 'Finalize Sunday Sermon Title & Scripture Readings',
              description: 'Select text from lectionary and outline key preaching themes for the bulletin.',
              priority: Priority.URGENT,
              subtasks: [
                'Confirm primary passage (e.g. Romans 8:1-11)',
                'Send title, scripture text, and summary to church office for printing',
              ],
            },
            {
              title: 'Select & Arrange Worship Music Set',
              description: 'Confirm 4 hymns & modern anthems aligned with the sermon theme.',
              priority: Priority.HIGH,
              subtasks: [
                'Choose opening call to worship hymn and response anthem',
                'Share CCLI chord charts and lead sheets with rhythm section',
                'Coordinate choir offertory piece with Director of Music',
              ],
            },
            {
              title: 'Schedule Liturgists & Communion Elders',
              description: 'Confirm volunteer leaders for both morning worship services.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Assign duty elder for the pastoral prayer',
                'Confirm lay scripture reader for first reading',
                'Schedule 4 communion servers for 9:00am & 11:00am services',
              ],
            },
            {
              title: 'Format & Proofread Sunday Service Bulletin',
              description: 'Layout prayers, order of worship, weekly announcements, and financial stewardship.',
              priority: Priority.HIGH,
              subtasks: [
                'Review hymn stanzas and responsive readings for typos',
                'Verify ministry calendar inserts and prayer list updates',
                'Send finalized PDF to office copier for 300-copy run',
              ],
            },
          ],
        },
        {
          name: 'Technical AV & Sanctuary Staging (Thu–Sat)',
          order: 1,
          tasks: [
            {
              title: 'Build ProPresenter Presentation Slide Deck',
              description: 'Prepare graphics, lyric typography, and scripture slides for the sanctuary screens.',
              priority: Priority.HIGH,
              subtasks: [
                'Format lyrics with high-contrast background templates',
                'Add sermon scripture slides and video announcements',
                'Import call-and-response liturgy slides',
              ],
            },
            {
              title: 'Audio Mic Battery Check & Sanctuary Tech Check',
              description: 'Test pulpit, lectern, and wireless lapel/headset microphones.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Insert fresh alkaline batteries into pastoral wireless transmitters',
                'Verify wireless hearing-assist packs at welcome kiosk',
                'Balance stage wedge monitors and choir microphones',
              ],
            },
            {
              title: 'Worship Band & Chancel Choir Rehearsal',
              description: 'Run through all service transitions, instrumental interludes, and choral anthems.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Conduct vocal and band warm-up run-through',
                'Check monitor levels and audio ear-mixes with sound engineer',
              ],
            },
          ],
        },
        {
          name: 'Sunday Morning Run-of-Show (Sun AM)',
          order: 2,
          tasks: [
            {
              title: 'Prepare Sacristy Communion Elements',
              description: 'Set out bread, chalices, and gluten-free wafers on the communion table.',
              priority: Priority.HIGH,
              subtasks: [
                'Fill communion chalices and tray cups with juice',
                'Drape fair linen and prepare quiet prayer space',
              ],
            },
            {
              title: 'Greeters & Ushers Morning Briefing',
              description: 'Distribute bulletins, review emergency exits, and ensure friendly welcome.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Stage 300 bulletins at north and south narthex entrances',
                'Review guest welcome gift bags and visitor connection cards',
              ],
            },
            {
              title: 'Initiate YouTube Live Stream & Pre-Service Audio Check',
              description: 'Broadcast stream start 15 minutes before prelude.',
              priority: Priority.URGENT,
              subtasks: [
                'Start YouTube live stream broadcast encoder',
                'Monitor live chat and verify broadcast audio loudness balance',
              ],
            },
            {
              title: 'Post-Service Sermon Archive & Website Podcast Upload',
              description: 'Trim audio recording and publish to church website media library.',
              priority: Priority.LOW,
              subtasks: [
                'Export MP3 audio track from soundboard multi-track recording',
                'Upload sermon recording with title and sermon notes to web archive',
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Campus Facilities & Operations Maintenance',
      description:
        'Preventative maintenance schedules, campus safety inspections, seasonal grounds work, and quick repairs across church property.',
      isTemplate: true,
      teamId: facilitiesTeam.id,
      stages: [
        {
          name: 'Campus Safety & Facility Inspections',
          order: 0,
          tasks: [
            {
              title: 'Quarterly Fire Extinguisher & Emergency Sign Inspection',
              description: 'Check pressure gauges, inspection tags, and emergency exit battery backups.',
              priority: Priority.HIGH,
              subtasks: [
                'Inspect 14 extinguishers across sanctuary, classrooms, and kitchen',
                'Test emergency exit battery backup push-bars and illuminated signs',
              ],
            },
            {
              title: 'Classroom & Nursery HVAC Filter Replacements',
              description: 'Replace commercial air handling filters with high-efficiency MERV-13 media.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Replace return filters in children’s education wing',
                'Inspect thermostat schedule programming for weekend service hours',
              ],
            },
            {
              title: 'Nursery & Children Wing Magnetic Door Latch Safety Test',
              description: 'Ensure automatic self-closing hinges and electromagnetic security latches work properly.',
              priority: Priority.URGENT,
              subtasks: ['Test magnetic release push-buttons', 'Adjust strike plates on doors 102 through 108'],
            },
          ],
        },
        {
          name: 'Active Maintenance Work Orders',
          order: 1,
          tasks: [
            {
              title: 'Repair Fellowship Hall Lighting Ballasts',
              description: 'Three fixtures are flickering in the fellowship hall; retrofit with LED tubes.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Turn off fellowship hall breaker #14',
                'Bypass old magnetic ballasts and install direct-wire LED tubes',
                'Test illumination and recycle spent tubes',
              ],
            },
            {
              title: 'Restroom Plumbing Repair in West Education Wing',
              description: 'Slow leak detected on flushometer valve in west wing men’s restroom.',
              priority: Priority.URGENT,
              subtasks: [
                'Shut off water supply to fixture',
                'Replace internal diaphragm assembly and vacuum breaker kit',
                'Test flush pressure and check for leaks',
              ],
            },
            {
              title: 'Touch-Up Wall Paint in Welcome Center',
              description: 'Patch small scuffs near reception desk and coffee bar.',
              priority: Priority.LOW,
              subtasks: ['Light spackle and sand drywall blemishes', 'Apply two coats of eggshell interior latex paint'],
            },
          ],
        },
        {
          name: 'Seasonal Grounds & Campus Upkeep',
          order: 2,
          tasks: [
            {
              title: 'Mow Campus Lawns & Edge Memorial Walkway',
              description: 'Weekly mowing and trimming before Sunday morning services.',
              priority: Priority.LOW,
              subtasks: [
                'Mow front sanctuary lawn and courtyard green',
                'Edge concrete sidewalks and blow clear of grass clippings',
              ],
            },
            {
              title: 'Winter De-Icer & Sidewalk Salt Readiness',
              description: 'Verify calcium chloride salt buckets are staged at all 6 campus entrances.',
              priority: Priority.HIGH,
              subtasks: [
                'Check inventory of 25 bags of pet-safe ice melt in maintenance shed',
                'Service two walk-behind rotary salt spreaders',
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Pastoral Care & Community Inquiries',
      description:
        'Congregational care, hospital visitation, Stephen ministry caregiving, meals ministry, and Deacon benevolence.',
      isTemplate: true,
      teamId: careTeam.id,
      stages: [
        {
          name: 'Care Intake & Initial Triage',
          order: 0,
          tasks: [
            {
              title: 'Log New Pastoral Care Request & Hospital Admission',
              description: 'Record confidential parishioner request and hospital room location.',
              priority: Priority.URGENT,
              subtasks: [
                'Contact family liaison to confirm visitation permissions and hours',
                'Share update during morning pastoral team prayer circle',
              ],
            },
            {
              title: 'Dispatch Deacon Benevolence Contact',
              description: 'Review confidential request for temporary utility or groceries assistance.',
              priority: Priority.HIGH,
              subtasks: [
                'Duty deacon phone call with parishioner',
                'Disburse emergency benevolence grocery vouchers',
              ],
            },
          ],
        },
        {
          name: 'Active Care Coordination',
          order: 1,
          tasks: [
            {
              title: 'In-Person Pastoral Hospital Visitation',
              description: 'Visit parishioner for scripture reading, prayer, and pastoral comfort.',
              priority: Priority.HIGH,
              subtasks: [
                'Provide bedside prayer and pastoral presence',
                'Leave encouraging handwritten card and devotional booklet',
              ],
            },
            {
              title: 'Coordinate 2-Week Meals Ministry Schedule',
              description: 'Organize meal drop-offs for recovering family following surgery.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Set up online MealTrain schedule with dietary preferences',
                'Distribute sign-up link to parishioner small group members',
              ],
            },
            {
              title: 'Assign Stephen Minister Caregiver',
              description: 'Pair parishioner with a trained lay Stephen Minister for bi-weekly spiritual companionship.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Consult with Stephen Ministry Leader for best caregiver match',
                'Conduct initial introduction call',
              ],
            },
          ],
        },
        {
          name: 'Ongoing Support & Resolution',
          order: 2,
          tasks: [
            {
              title: 'Day-14 Post-Discharge Pastoral Follow-Up Call',
              description: 'Check in on homebound recovery and determine if communion visit is desired.',
              priority: Priority.MEDIUM,
              subtasks: ['Assess ongoing mobility and transportation needs', 'Schedule homebound communion delivery'],
            },
            {
              title: 'Update Confidential Care Records & Close Care Ticket',
              description: 'Archive care timeline with confidential pastoral notes.',
              priority: Priority.LOW,
              subtasks: ['Log completion notes into secure pastoral record', 'Close active care ticket'],
            },
          ],
        },
      ],
    },
    {
      name: 'Ministry Events & Seasonal Retreats',
      description:
        'Planning lifecycle for student retreats, volunteer background checks, registration forms, catering, and trip execution.',
      isTemplate: true,
      teamId: youthTeam.id,
      stages: [
        {
          name: 'Concept, Venue & Budget',
          order: 0,
          tasks: [
            {
              title: 'Book Camp Wildwood Retreat Venue & Submit Deposit',
              description: 'Confirm fall weekend dates (Oct 16–18) and secure contract with retreat center.',
              priority: Priority.HIGH,
              subtasks: [
                'Submit event proposal and estimated headcount to Session for approval',
                'Process $500 facility reservation deposit with church treasurer',
              ],
            },
            {
              title: 'Establish Event Budget & Student Registration Fees',
              description: 'Calculate lodging, food service, chartered transportation, and scholarship fund.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Set $145 early-bird registration fee and $175 regular rate',
                'Designate $1,200 from youth benevolence fund for need-based scholarships',
              ],
            },
          ],
        },
        {
          name: 'Registration & Transportation Logistics',
          order: 1,
          tasks: [
            {
              title: 'Launch Online Student Registration & Medical Waiver Form',
              description: 'Publish digital registration portal with parent emergency contact authorization.',
              priority: Priority.HIGH,
              subtasks: [
                'Embed medical insurance upload and parent liability agreement',
                'Promote registration link via youth newsletter and Instagram announcement',
              ],
            },
            {
              title: 'Reserve Chartered Bus Transportation',
              description: 'Book 54-passenger coach bus for Friday evening departure and Sunday afternoon return.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Review bus charter contract and driver lodging arrangements',
                'Distribute parking lot drop-off instructions to parents',
              ],
            },
            {
              title: 'Compile Dietary & Allergy Headcount for Camp Kitchen',
              description: 'Provide final meal counts and dietary alerts to camp culinary staff.',
              priority: Priority.MEDIUM,
              subtasks: [
                'Flag gluten-free, dairy-free, and nut allergies',
                'Confirm Friday evening arrival pizza buffet headcount',
              ],
            },
          ],
        },
        {
          name: 'Safety, Chaperones & Run-of-Show',
          order: 2,
          tasks: [
            {
              title: 'Complete Volunteer Chaperone Background Checks',
              description: 'Verify national criminal background screening and child protection certification.',
              priority: Priority.URGENT,
              subtasks: [
                'Verify all 6 adult leaders have current background check clearances',
                'Conduct 30-minute chaperone safety orientation meeting',
              ],
            },
            {
              title: 'Assemble Travel First Aid & Emergency Medication Kits',
              description: 'Pack first aid supplies and student prescription medication log.',
              priority: Priority.HIGH,
              subtasks: [
                'Restock sterile bandages, cold packs, burn cream, and CPR shield',
                'Prepare lockable medical organizer box for daily prescriptions',
              ],
            },
            {
              title: 'Send Post-Retreat Evaluation Survey & Photo Gallery',
              description: 'Email parents and students with photo recap and feedback questionnaire.',
              priority: Priority.LOW,
              subtasks: [
                'Curate weekend highlight video for Sunday morning youth service',
                'Distribute 5-question Google Form survey for student feedback',
              ],
            },
          ],
        },
      ],
    },
  ];

  const createdWorkflows: Array<{ id: string; name: string }> = [];

  for (const wDef of workflowDefinitions) {
    let workflow = await prisma.workflow.findFirst({ where: { name: wDef.name } });
    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          name: wDef.name,
          description: wDef.description,
          isTemplate: wDef.isTemplate,
          teamId: wDef.teamId,
          createdById: pastor.id,
        },
      });

      for (const sDef of wDef.stages) {
        const stage = await prisma.workflowStage.create({
          data: {
            workflowId: workflow.id,
            name: sDef.name,
            order: sDef.order,
          },
        });

        let taskOrder = 0;
        for (const tDef of sDef.tasks) {
          const taskTemplate = await prisma.workflowTaskTemplate.create({
            data: {
              stageId: stage.id,
              title: tDef.title,
              description: tDef.description,
              defaultPriority: tDef.priority,
              order: taskOrder++,
            },
          });

          let subOrder = 0;
          for (const subTitle of tDef.subtasks) {
            await prisma.workflowTaskTemplate.create({
              data: {
                stageId: stage.id,
                parentId: taskTemplate.id,
                title: subTitle,
                order: subOrder++,
                defaultPriority: tDef.priority,
              },
            });
          }
        }
      }
    }
    createdWorkflows.push({ id: workflow.id, name: workflow.name });
  }

  // 4. Create or Update Live Interactive Projects showcasing these Workflows
  const demoProjects = [
    {
      name: 'Sunday Worship & Liturgy',
      description: 'Weekly worship service planning, preaching outlines, AV technology, and Sunday morning logistics.',
      workflowId: createdWorkflows[0]?.id,
      createdById: pastor.id,
      members: [pastor.id, officeManager.id, volunteer.id],
      sections: [
        {
          name: 'Pre-Service Prep (Mon–Wed)',
          order: 0,
          tasks: [
            {
              title: 'Finalize Sunday Sermon Title & Scripture Readings',
              description: 'Passage: Romans 8:1-11 — "No Condemnation in Christ Jesus"',
              priority: Priority.URGENT,
              status: TaskStatus.DONE,
              assigneeId: pastor.id,
              dueDate: daysFromNow(-1),
            },
            {
              title: 'Select & Arrange Worship Music Set',
              description: 'Songs: "Be Thou My Vision", "In Christ Alone", "Lord I Need You", "Doxology"',
              priority: Priority.HIGH,
              status: TaskStatus.DONE,
              assigneeId: volunteer.id,
              dueDate: daysFromNow(0),
            },
            {
              title: 'Schedule Liturgists & Communion Elders',
              description: 'Elder Bob Miller for prayer, Deacon Linda for Scripture reading.',
              priority: Priority.MEDIUM,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: officeManager.id,
              dueDate: daysFromNow(1),
            },
            {
              title: 'Format & Proofread Sunday Service Bulletin',
              description: 'Send 300-copy PDF print order by Friday noon.',
              priority: Priority.HIGH,
              status: TaskStatus.TODO,
              assigneeId: officeManager.id,
              dueDate: daysFromNow(2),
            },
          ],
        },
        {
          name: 'Technical AV & Staging (Thu–Sat)',
          order: 1,
          tasks: [
            {
              title: 'Build ProPresenter Presentation Slide Deck',
              description: 'Enter lyrics with contrast backgrounds, sermon slides, and video announcements.',
              priority: Priority.HIGH,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: volunteer.id,
              dueDate: daysFromNow(3),
            },
            {
              title: 'Wireless Microphone Fresh Battery Check',
              description: 'Insert fresh 9V/AA cells into lapels and wireless handhelds.',
              priority: Priority.MEDIUM,
              status: TaskStatus.TODO,
              assigneeId: volunteer.id,
              dueDate: daysFromNow(3),
            },
            {
              title: 'Chancel Choir & Band Rehearsal',
              description: 'Thursday 7:00pm in the Sanctuary.',
              priority: Priority.MEDIUM,
              status: TaskStatus.TODO,
              assigneeId: pastor.id,
              dueDate: daysFromNow(2),
            },
          ],
        },
        {
          name: 'Sunday Morning Run-of-Show',
          order: 2,
          tasks: [
            {
              title: 'Prepare Sacristy Communion Elements',
              description: 'Fill chalices with grape juice and place fresh gluten-free wafers in patens.',
              priority: Priority.HIGH,
              status: TaskStatus.TODO,
              assigneeId: officeManager.id,
              dueDate: daysFromNow(4),
            },
            {
              title: 'Initiate YouTube Live Stream Broadcast',
              description: 'Begin broadcast 15 minutes before prelude (8:45am & 10:45am).',
              priority: Priority.URGENT,
              status: TaskStatus.TODO,
              assigneeId: volunteer.id,
              dueDate: daysFromNow(4),
            },
          ],
        },
      ],
    },
    {
      name: 'Campus Facilities & Maintenance',
      description: 'Building upkeep, safety inspections, work orders, and groundskeeping across church campus.',
      workflowId: createdWorkflows[1]?.id,
      createdById: officeManager.id,
      members: [pastor.id, officeManager.id, facilitiesLead.id],
      sections: [
        {
          name: 'Safety Inspections',
          order: 0,
          tasks: [
            {
              title: 'Quarterly Fire Extinguisher Inspection',
              description: 'All 14 campus units checked and certified.',
              priority: Priority.HIGH,
              status: TaskStatus.DONE,
              assigneeId: facilitiesLead.id,
              dueDate: daysFromNow(-3),
            },
            {
              title: 'Classroom & Nursery HVAC Filter Replacements',
              description: 'Replace return air filters with MERV-13 units in children’s wing.',
              priority: Priority.MEDIUM,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: facilitiesLead.id,
              dueDate: daysFromNow(1),
            },
          ],
        },
        {
          name: 'Active Work Orders',
          order: 1,
          tasks: [
            {
              title: 'Repair Fellowship Hall Lighting Ballasts',
              description: 'Convert three fluorescent troffers to direct-wire LED panels.',
              priority: Priority.HIGH,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: facilitiesLead.id,
              dueDate: daysFromNow(2),
            },
            {
              title: 'West Wing Restroom Flushometer Leak',
              description: 'Replace diaphragm assembly to stop slow fixture drip.',
              priority: Priority.URGENT,
              status: TaskStatus.TODO,
              assigneeId: facilitiesLead.id,
              dueDate: daysFromNow(1),
            },
          ],
        },
        {
          name: 'Seasonal Grounds',
          order: 2,
          tasks: [
            {
              title: 'Mow Campus Front Lawns & Edge Sidewalks',
              description: 'Grounds maintenance ahead of weekend worship services.',
              priority: Priority.LOW,
              status: TaskStatus.TODO,
              assigneeId: facilitiesLead.id,
              dueDate: daysFromNow(3),
            },
          ],
        },
      ],
    },
    {
      name: 'Pastoral Care & Community Inquiries',
      description: 'Congregational care, hospital visitation, Stephen ministry caregiving, and meals ministry.',
      workflowId: createdWorkflows[2]?.id,
      createdById: pastor.id,
      members: [pastor.id, officeManager.id],
      sections: [
        {
          name: 'Care Intake & Triage',
          order: 0,
          tasks: [
            {
              title: 'Triage Hospitalization: Mrs. Higgins (St. Luke’s)',
              description: 'Room 412 following hip surgery; pastoral visit requested.',
              priority: Priority.URGENT,
              status: TaskStatus.DONE,
              assigneeId: pastor.id,
              dueDate: daysFromNow(-2),
            },
          ],
        },
        {
          name: 'Active Care Coordination',
          order: 1,
          tasks: [
            {
              title: 'Bedside Hospital Visit & Communion',
              description: 'Visit Mrs. Higgins and offer scripture reading and prayer.',
              priority: Priority.HIGH,
              status: TaskStatus.DONE,
              assigneeId: pastor.id,
              dueDate: daysFromNow(-1),
            },
            {
              title: 'Coordinate 2-Week Meals Ministry Schedule',
              description: 'Set up MealTrain calendar with dietary preferences for Higgins family.',
              priority: Priority.MEDIUM,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: officeManager.id,
              dueDate: daysFromNow(2),
            },
            {
              title: 'Stephen Minister Assignment',
              description: 'Pair with Stephen Minister for weekly post-rehab visitation.',
              priority: Priority.MEDIUM,
              status: TaskStatus.TODO,
              assigneeId: pastor.id,
              dueDate: daysFromNow(5),
            },
          ],
        },
      ],
    },
    {
      name: 'Youth Ministry Fall Retreat',
      description: 'Planning for annual high school retreat at Camp Wildwood: registration, chaperones, and transport.',
      workflowId: createdWorkflows[3]?.id,
      createdById: youthPastor.id,
      members: [pastor.id, youthPastor.id, volunteer.id],
      sections: [
        {
          name: 'Concept & Venue',
          order: 0,
          tasks: [
            {
              title: 'Book Camp Wildwood Venue & Pay Deposit',
              description: 'Dates confirmed for Oct 16–18. $500 deposit check paid.',
              priority: Priority.HIGH,
              status: TaskStatus.DONE,
              assigneeId: youthPastor.id,
              dueDate: daysFromNow(-10),
            },
          ],
        },
        {
          name: 'Registration & Logistics',
          order: 1,
          tasks: [
            {
              title: 'Publish Online Registration & Liability Waiver',
              description: 'Early bird registration open; medical release form included.',
              priority: Priority.HIGH,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: youthPastor.id,
              dueDate: daysFromNow(4),
            },
            {
              title: 'Reserve 54-Passenger Chartered Coach Bus',
              description: 'Contract confirmed with First Class Charters.',
              priority: Priority.MEDIUM,
              status: TaskStatus.DONE,
              assigneeId: youthPastor.id,
              dueDate: daysFromNow(-3),
            },
          ],
        },
        {
          name: 'Safety & Chaperones',
          order: 2,
          tasks: [
            {
              title: 'Complete Volunteer Chaperone Background Screenings',
              description: 'All 6 adult volunteers background checked and approved.',
              priority: Priority.URGENT,
              status: TaskStatus.IN_PROGRESS,
              assigneeId: youthPastor.id,
              dueDate: daysFromNow(3),
            },
            {
              title: 'Pack Travel First Aid Kit & Medication Box',
              description: 'Restock travel kit and verify emergency contact binder.',
              priority: Priority.HIGH,
              status: TaskStatus.TODO,
              assigneeId: volunteer.id,
              dueDate: daysFromNow(6),
            },
          ],
        },
      ],
    },
  ];

  let projectsCreatedCount = 0;

  for (const pDef of demoProjects) {
    let project = await prisma.project.findFirst({ where: { name: pDef.name } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          name: pDef.name,
          description: pDef.description,
          workflowId: pDef.workflowId,
          createdById: pDef.createdById,
          members: { create: pDef.members.map((id) => ({ userId: id })) },
        },
      });
      projectsCreatedCount++;

      for (const sDef of pDef.sections) {
        const section = await prisma.section.create({
          data: {
            projectId: project.id,
            name: sDef.name,
            order: sDef.order,
          },
        });

        let taskOrder = 0;
        for (const tDef of sDef.tasks) {
          await prisma.task.create({
            data: {
              projectId: project.id,
              sectionId: section.id,
              title: tDef.title,
              description: tDef.description,
              priority: tDef.priority,
              status: tDef.status,
              dueDate: tDef.dueDate,
              order: taskOrder++,
              assignees: { connect: { id: tDef.assigneeId } },
            },
          });
        }
      }
    }
  }

  return {
    workflowsCount: createdWorkflows.length,
    projectsCreatedCount,
  };
}
