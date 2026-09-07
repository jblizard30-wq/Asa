import { addDays, parseISO } from 'date-fns';
import type { Priority, RaciRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isModuleEnabled } from '@/lib/modules';

export interface PlaybookRaci {
  responsible: string;
  accountable: string;
  consulted?: string;
  informed?: string;
  primaryRole?: RaciRole;
}

export interface PlaybookTaskTemplate {
  title: string;
  description: string;
  priority: Priority;
  dueOffsetDays: number;
  startOffsetDays?: number;
  raci: PlaybookRaci;
  tags?: string[];
  subtasks?: {
    title: string;
    description?: string;
    dueOffsetDays?: number;
    priority?: Priority;
  }[];
}

export interface PlaybookSectionTemplate {
  name: string;
  order: number;
  tasks: PlaybookTaskTemplate[];
}

export interface MinistryPlaybook {
  id: string;
  name: string;
  description: string;
  category: 'Worship & Liturgy' | 'Children & Family' | 'Stewardship & Governance' | 'Discipleship & Formation';
  estimatedWeeks: number;
  icon: string;
  color: string;
  sections: PlaybookSectionTemplate[];
}

export const MINISTRY_PLAYBOOKS: MinistryPlaybook[] = [
  {
    id: 'easter-sunday-intensive',
    name: 'Easter Sunday Intensive',
    description:
      'A 6-week liturgical and operational master timeline preparing the church for Holy Week and Easter Sunday. Coordinates facilities, music, AV tech, altar guild lilies, sacramental communion preparation, and hospitality.',
    category: 'Worship & Liturgy',
    estimatedWeeks: 6,
    icon: '✝️',
    color: 'amber',
    sections: [
      {
        name: 'Facilities, Sanctuary & Overflow Setup',
        order: 0,
        tasks: [
          {
            title: 'Sanctuary & Campus Walkthrough for Easter Capacity',
            description:
              'Conduct thorough facilities inspection of sanctuary, narthex, restrooms, and parking lots. Determine overflow seating layout (fellowship hall video feed) and service equipment.',
            priority: 'HIGH',
            dueOffsetDays: 0,
            startOffsetDays: 0,
            raci: {
              responsible: 'Facilities Director',
              accountable: 'Executive Pastor',
              consulted: 'Head Usher',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
            subtasks: [
              { title: 'Check all chancel and pew lighting ballasts and bulbs' },
              { title: 'Measure fellowship hall overflow perimeter and chair layout' },
              { title: 'Inspect outdoor signage and cross lighting' },
            ],
          },
          {
            title: 'Service HVAC Systems & Order Banner Hardware',
            description:
              'Ensure sanctuary heating, ventilation, and cooling are serviced for high-density attendance. Inspect festive banner suspension cables and hardware.',
            priority: 'MEDIUM',
            dueOffsetDays: 10,
            raci: {
              responsible: 'Facilities Manager',
              accountable: 'Facilities Director',
              consulted: 'Altar Guild Chair',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Deep Clean Sanctuary Pews, Carpets & Narthex Glass',
            description:
              'Coordinate custodial crew for comprehensive deep cleaning of the sanctuary, polished woodwork, cleaned pew hymnal racks, and spotless narthex glass.',
            priority: 'HIGH',
            dueOffsetDays: 31,
            raci: {
              responsible: 'Custodial Lead',
              accountable: 'Facilities Director',
              informed: 'Executive Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Deploy Overflow Seating, Staging & Parking Lot Cones',
            description:
              'Set up 150 overflow chairs in fellowship hall with direct AV link. Place directional parking cones and reserve volunteer parking stalls.',
            priority: 'URGENT',
            dueOffsetDays: 39,
            raci: {
              responsible: 'Facilities Crew',
              accountable: 'Facilities Director',
              consulted: 'Head Usher',
              informed: 'Safety Team',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Post-Easter Sanctuary Reset & Overflow Stowage',
            description:
              'Reset chancel and fellowship hall following Sunday services. Return overflow chairs, pack seasonal banners, and vacuum common spaces.',
            priority: 'MEDIUM',
            dueOffsetDays: 43,
            raci: {
              responsible: 'Facilities Crew',
              accountable: 'Facilities Director',
              informed: 'Executive Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Choir, Orchestra & Worship Arts',
        order: 1,
        tasks: [
          {
            title: 'Finalize Easter Choral Anthems & Order Orchestral Scores',
            description:
              'Select festival anthems for Easter services, print vocal scores, and secure orchestral parts for brass quartet and percussion.',
            priority: 'HIGH',
            dueOffsetDays: 3,
            raci: {
              responsible: 'Choir Director',
              accountable: 'Pastor of Worship',
              consulted: 'Senior Pastor',
              informed: 'Accompanist',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Contract Guest Brass Quartet & Timpanist',
            description:
              'Confirm musician contracts, performance call times, rehearsal schedules, and honoraria vouchers for guest instrumentalists.',
            priority: 'HIGH',
            dueOffsetDays: 8,
            raci: {
              responsible: 'Pastor of Worship',
              accountable: 'Executive Pastor',
              informed: 'Choir Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Combined Choir & Brass Rehearsals',
            description:
              'Mid-intensive choral rehearsals integrating brass parts, tempo transitions, and liturgical hymn accompaniment.',
            priority: 'MEDIUM',
            dueOffsetDays: 17,
            raci: {
              responsible: 'Choir Director',
              accountable: 'Pastor of Worship',
              consulted: 'Accompanist',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Prepare Holy Week Maundy Thursday & Good Friday Tenebrae Music',
            description:
              'Rehearse solemn choral reflections, somber psalm settings, and extinguishing of candles sequence for Holy Week evening services.',
            priority: 'HIGH',
            dueOffsetDays: 30,
            raci: {
              responsible: 'Choir Director',
              accountable: 'Pastor of Worship',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Saturday Full Easter Dress Rehearsal with Brass & AV',
            description:
              'Final run-through in sanctuary with choir, brass, organ, pulpit clergy, and audio/video tech team. Lock service timing.',
            priority: 'URGENT',
            dueOffsetDays: 40,
            raci: {
              responsible: 'Choir Director',
              accountable: 'Pastor of Worship',
              consulted: 'Tech Director',
              informed: 'Executive Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Audio/Visual & Streaming Tech',
        order: 2,
        tasks: [
          {
            title: 'Wireless Microphone Frequency Audit & Battery Supply',
            description:
              'Check RF frequencies for all wireless handhelds and lapels to avoid interference. Stock fresh lithium batteries and clean capsules.',
            priority: 'MEDIUM',
            dueOffsetDays: 5,
            raci: {
              responsible: 'Audio Engineer',
              accountable: 'Tech Director',
              informed: 'Pastor of Worship',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Program Lighting Cues for Sunrise, Festival & Tenebrae Services',
            description:
              'Save lighting presets on console for Maundy Thursday communion, Good Friday progressive darkening, and Easter morning resurrection bright wash.',
            priority: 'MEDIUM',
            dueOffsetDays: 18,
            raci: {
              responsible: 'Lighting Lead',
              accountable: 'Tech Director',
              consulted: 'Pastor of Worship',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Stress-Test Streaming Bandwidth & Video Switcher Failover',
            description:
              'Simulate peak livestream concurrent viewers, verify backup cellular internet bonding, and calibrate overflow hall TV video feeds.',
            priority: 'HIGH',
            dueOffsetDays: 24,
            raci: {
              responsible: 'Broadcast Producer',
              accountable: 'Tech Director',
              informed: 'Communications Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Holy Week & Easter AV Run-Through with Preaching Team',
            description:
              'Test sermon slides, Scripture graphics, confidence monitors, and lapel clip positions with preaching pastors.',
            priority: 'HIGH',
            dueOffsetDays: 33,
            raci: {
              responsible: 'Tech Director',
              accountable: 'Senior Pastor',
              consulted: 'Pastor of Worship',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Easter Sunday Multi-Service Live Production & Archiving',
            description:
              'Execute live mixing, camera switching, master audio recording, and high-definition cloud archiving across all Easter services.',
            priority: 'URGENT',
            dueOffsetDays: 42,
            raci: {
              responsible: 'Tech Director',
              accountable: 'Executive Pastor',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Altar Guild & Easter Lilies',
        order: 3,
        tasks: [
          {
            title: 'Launch Easter Lily Dedications Campaign',
            description:
              'Publish bulletin announcements and web forms inviting members to dedicate memorial and thanksgiving lilies for the chancel.',
            priority: 'MEDIUM',
            dueOffsetDays: 7,
            raci: {
              responsible: 'Altar Guild Chair',
              accountable: 'Communications Director',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Place Wholesale Floral & Lily Order with Local Nursery',
            description:
              'Tally submitted dedications and order 120 potted Easter lilies with gold foil wrappers and white pedestals.',
            priority: 'HIGH',
            dueOffsetDays: 15,
            raci: {
              responsible: 'Altar Guild Chair',
              accountable: 'Executive Pastor',
              informed: 'Church Treasurer',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Finalize Easter Sunday Lily Memorial Program Insert',
            description:
              'Proofread and print the commemorative memorial booklet listing all donors and loved ones honored, inserted into Easter bulletins.',
            priority: 'HIGH',
            dueOffsetDays: 32,
            raci: {
              responsible: 'Publications Coordinator',
              accountable: 'Altar Guild Chair',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Receive Lily Delivery, Water & Decorate Chancel Cross',
            description:
              'Inspect incoming lily delivery, trim dead leaves, hydrate plants, and array ascending banks of lilies around chancel steps and cross.',
            priority: 'URGENT',
            dueOffsetDays: 41,
            raci: {
              responsible: 'Altar Guild Team',
              accountable: 'Altar Guild Chair',
              consulted: 'Facilities Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Distribute Dedication Lilies to Homebound & Bereaved Members',
            description:
              'Coordinate deacons to package and hand-deliver dedication lilies to nursing homes, hospitalized, and grieving church members.',
            priority: 'LOW',
            dueOffsetDays: 43,
            raci: {
              responsible: 'Care Deacon Chair',
              accountable: 'Associate Pastor',
              informed: 'Altar Guild Chair',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Communion Preparation & Sacraments',
        order: 4,
        tasks: [
          {
            title: 'Inventory Chalices, Trays, Gluten-Free Elements & Juice',
            description:
              'Check sacramental silver/brass trays, communion cups, gluten-free sealed wafers, and grape juice cases in sacristy storage.',
            priority: 'MEDIUM',
            dueOffsetDays: 12,
            raci: {
              responsible: 'Sacramental Deacon',
              accountable: 'Associate Pastor',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Order Fresh Artisan Loaves & Sacramental Supplies',
            description:
              'Order unsliced sourdough/artisan loaves from bakery for Maundy Thursday and Easter communion services.',
            priority: 'HIGH',
            dueOffsetDays: 25,
            raci: {
              responsible: 'Sacramental Deacon',
              accountable: 'Associate Pastor',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Schedule & Brief Elder Communion Serving Teams',
            description:
              'Schedule 16 Ruling Elders across services for bread and cup distribution. Issue serving protocol instructions.',
            priority: 'HIGH',
            dueOffsetDays: 29,
            raci: {
              responsible: 'Clerk of Session',
              accountable: 'Senior Pastor',
              consulted: 'Associate Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Prepare Elements, Fill Trays & Drape Sacramental Table',
            description:
              'Cut bread cubes, fill communion cups, position gluten-free station, and cover communion elements with immaculate white linen.',
            priority: 'URGENT',
            dueOffsetDays: 41,
            raci: {
              responsible: 'Altar Guild & Deacons',
              accountable: 'Clerk of Session',
              consulted: 'Associate Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Guest Welcome, Ushers & Hospitality',
        order: 5,
        tasks: [
          {
            title: 'Recruit & Schedule 24 Easter Ushers Across Services',
            description:
              'Build usher staffing roster for sunrise, early, and festival services. Assign head ushers for each service.',
            priority: 'HIGH',
            dueOffsetDays: 9,
            raci: {
              responsible: 'Head Usher',
              accountable: 'Associate Pastor',
              informed: 'Executive Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Assemble 300 First-Time Visitor Welcome Gift Packets',
            description:
              'Pack branded welcome gift bags with church introduction brochure, pastor’s note, gourmet coffee pouch, and visitor cards.',
            priority: 'MEDIUM',
            dueOffsetDays: 26,
            raci: {
              responsible: 'Hospitality Lead',
              accountable: 'Associate Pastor',
              informed: 'Communications Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Safety, Medical Team & Emergency Response Briefing',
            description:
              'Review AED locations, first aid kits, emergency exit protocols, and police officer detail schedule with safety volunteers.',
            priority: 'HIGH',
            dueOffsetDays: 34,
            raci: {
              responsible: 'Safety Team Director',
              accountable: 'Executive Pastor',
              consulted: 'Head Usher',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Station Greeters at Entrances, Coffee Bars & Parking Areas',
            description:
              'Deploy greeters at all exterior doors, parking lot crossings, and fellowship coffee stations 45 minutes prior to services.',
            priority: 'URGENT',
            dueOffsetDays: 42,
            raci: {
              responsible: 'Head Usher',
              accountable: 'Hospitality Lead',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'vacation-bible-school',
    name: 'Vacation Bible School (VBS)',
    description:
      'Turnkey summer children’s ministry campaign managing curriculum, volunteer recruitment, child protection compliance, student registration, stage set fabrication, and daily snacks.',
    category: 'Children & Family',
    estimatedWeeks: 8,
    icon: '🎈',
    color: 'emerald',
    sections: [
      {
        name: 'Curriculum & Theme Planning',
        order: 0,
        tasks: [
          {
            title: 'Select & Order VBS Starter Kit and Director Manuals',
            description:
              'Review publishing house themes, evaluate theological alignment, and purchase the core starter kit, music videos, and station guides.',
            priority: 'HIGH',
            dueOffsetDays: 0,
            raci: {
              responsible: "Children's Ministry Director",
              accountable: 'Family Pastor',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Plan Station Rotations & Schedule Map',
            description:
              'Design 20-minute daily rotation master schedule: Bible Expedition, Science Lab, Crafts, Games, and Music Assembly.',
            priority: 'MEDIUM',
            dueOffsetDays: 10,
            raci: {
              responsible: 'VBS Director',
              accountable: "Children's Ministry Director",
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Order Student Activity Workbooks & Theme Bandanas',
            description:
              'Calculate enrollment estimates and purchase customized participant t-shirts, iron-on patches, and daily devotional booklets.',
            priority: 'MEDIUM',
            dueOffsetDays: 18,
            raci: {
              responsible: 'VBS Administrator',
              accountable: "Children's Ministry Director",
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Fabricate Sanctuary Theme Stage Set & Backdrops',
            description:
              'Coordinate volunteer woodworkers and artists to build theatrical props, themed entryway arches, and projection backdrops.',
            priority: 'MEDIUM',
            dueOffsetDays: 25,
            raci: {
              responsible: 'Stage Craft Lead',
              accountable: 'VBS Director',
              consulted: 'Facilities Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Volunteer Recruitment & Staffing',
        order: 1,
        tasks: [
          {
            title: 'Launch Volunteer Recruitment Campaign',
            description:
              'Target 60 adult and teen volunteers across station leaders, small group crew leaders, decorators, and registration greeters.',
            priority: 'HIGH',
            dueOffsetDays: 7,
            raci: {
              responsible: 'Volunteer Coordinator',
              accountable: "Children's Ministry Director",
              informed: 'Family Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Host All-Volunteer Kickoff & Station Leader Orientation',
            description:
              'Walk volunteers through the weekly theme, lesson plans, group control strategies, and emergency procedures.',
            priority: 'HIGH',
            dueOffsetDays: 32,
            raci: {
              responsible: 'VBS Director',
              accountable: 'Family Pastor',
              consulted: 'Volunteer Coordinator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Assign Teen Crew Assistants & Grade Level Pairings',
            description:
              'Pair each high school / middle school assistant with a vetted adult crew leader for grade-specific groups.',
            priority: 'MEDIUM',
            dueOffsetDays: 40,
            raci: {
              responsible: 'Youth Pastor',
              accountable: 'VBS Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Final Volunteer Classroom Walkthrough & Dress Rehearsal',
            description:
              'Inspect designated classrooms, supply bins, and rehearse opening/closing assembly songs with choreography team.',
            priority: 'URGENT',
            dueOffsetDays: 51,
            raci: {
              responsible: 'VBS Director',
              accountable: "Children's Ministry Director",
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Safety, Background Checks & Compliance',
        order: 2,
        tasks: [
          {
            title: 'Audit Criminal Background Checks for All Adult Applicants',
            description:
              'Process national sex offender and criminal background verification for every adult volunteer (no exceptions).',
            priority: 'URGENT',
            dueOffsetDays: 14,
            raci: {
              responsible: 'Child Protection Officer',
              accountable: 'Executive Pastor',
              informed: "Children's Ministry Director",
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Mandatory Child Sexual Abuse Prevention Training',
            description:
              'Verify completion of two-adult rule, restroom escort guidelines, and mandatory reporting legal compliance certificates.',
            priority: 'HIGH',
            dueOffsetDays: 24,
            raci: {
              responsible: 'Child Protection Officer',
              accountable: 'Executive Pastor',
              consulted: 'VBS Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Configure Secure Child Check-In & Authorized Pickup Badges',
            description:
              'Set up electronic label printers, parent claim tags, security wristbands, and designated runner checkpoints.',
            priority: 'HIGH',
            dueOffsetDays: 42,
            raci: {
              responsible: 'Check-In Coordinator',
              accountable: 'VBS Director',
              informed: 'Safety Team Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Medical Roster, Severe Allergy Protocols & First Aid Station',
            description:
              'Review medical forms with Parish Nurse; prepare allergy-alert color lanyards and stock EpiPens in designated lockbox.',
            priority: 'URGENT',
            dueOffsetDays: 47,
            raci: {
              responsible: 'Parish Nurse',
              accountable: "Children's Ministry Director",
              consulted: 'VBS Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Student Registration & Crew Placement',
        order: 3,
        tasks: [
          {
            title: 'Publish Online Registration Portal with Grade Quotas',
            description:
              'Open registration for church members followed by community families. Cap each age group based on classroom fire code.',
            priority: 'HIGH',
            dueOffsetDays: 8,
            raci: {
              responsible: 'Communications Director',
              accountable: 'VBS Director',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Process Waitlists & Special Accommodation Requests',
            description:
              'Track grade-level capacity, manage sibling groupings, and coordinate special needs buddy volunteer pairings.',
            priority: 'MEDIUM',
            dueOffsetDays: 28,
            raci: {
              responsible: 'VBS Registrar',
              accountable: "Children's Ministry Director",
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Finalize Small Group Rosters (1:5 Adult to Child Ratio)',
            description:
              'Generate printed group rosters, roster clipboards, nametags, and attendance sheets for all station leaders.',
            priority: 'HIGH',
            dueOffsetDays: 45,
            raci: {
              responsible: 'VBS Registrar',
              accountable: 'VBS Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Send Parent Welcome & Drop-Off Protocol Email Packets',
            description:
              'Email parents with carpool instructions, morning drop-off maps, pickup security tag requirements, and theme dress days.',
            priority: 'HIGH',
            dueOffsetDays: 49,
            raci: {
              responsible: 'Communications Director',
              accountable: 'VBS Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Snacks, Hospitality & Closing Celebration',
        order: 4,
        tasks: [
          {
            title: 'Formulate Daily Allergy-Safe Themed Snack Menu',
            description:
              'Plan 5 days of thematic snacks ensuring gluten-free, dairy-free, and nut-free alternatives for each station.',
            priority: 'MEDIUM',
            dueOffsetDays: 20,
            raci: {
              responsible: 'Snack Coordinator',
              accountable: 'VBS Director',
              consulted: 'Parish Nurse',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Purchase Wholesale Grocery Supplies, Paper Goods & Sanitizer',
            description:
              'Source bulk pretzels, fruit cups, juice boxes, napkins, sanitizing wipes, and compostable cups.',
            priority: 'MEDIUM',
            dueOffsetDays: 38,
            raci: {
              responsible: 'Snack Coordinator',
              accountable: 'VBS Director',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Organize Friday Family Night Dinner & Musical Showcase',
            description:
              'Book hot dog / taco catering, arrange lawn seating, setup outdoor PA system, and prepare student certificate handouts.',
            priority: 'HIGH',
            dueOffsetDays: 46,
            raci: {
              responsible: 'Hospitality Team',
              accountable: 'Family Pastor',
              consulted: 'Facilities Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Post-VBS Facility Teardown, Inventory Restock & Volunteer Thanks',
            description:
              'Dismantle props, clean classrooms, return equipment, send volunteer appreciation cards, and host thank-you dessert.',
            priority: 'MEDIUM',
            dueOffsetDays: 56,
            raci: {
              responsible: 'VBS Director',
              accountable: "Children's Ministry Director",
              consulted: 'Facilities Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'annual-stewardship',
    name: 'Annual Stewardship & Capital Campaign',
    description:
      'A 7-week comprehensive church generosity campaign guiding the congregation through prayer, vision, pledge cards, congregational dinner, Commitment Sunday, and pastoral gratitude.',
    category: 'Stewardship & Governance',
    estimatedWeeks: 7,
    icon: '🌾',
    color: 'blue',
    sections: [
      {
        name: 'Campaign Leadership & Committee Kickoff',
        order: 0,
        tasks: [
          {
            title: 'Convene Stewardship Steering Committee & Appoint Chair',
            description:
              'Form cross-functional steering committee of ruling elders, trustees, and ministry leaders; define campaign charter and calendar.',
            priority: 'HIGH',
            dueOffsetDays: 0,
            raci: {
              responsible: 'Stewardship Chair',
              accountable: 'Senior Pastor',
              consulted: 'Executive Pastor',
              informed: 'Session of Elders',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Adopt Biblical Theme, Generosity Vision & Narrative Budget',
            description:
              'Establish the campaign spiritual theme and key Scripture text; approve storytelling narrative budget showcasing ministry impact.',
            priority: 'HIGH',
            dueOffsetDays: 5,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Stewardship Chair',
              consulted: 'Finance Committee Chair',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Session & Finance Committee Campaign Endorsement',
            description:
              'Present proposed campaign goals, pledge card format, and capital budget projections to Session for formal approval.',
            priority: 'HIGH',
            dueOffsetDays: 12,
            raci: {
              responsible: 'Clerk of Session',
              accountable: 'Finance Committee Chair',
              informed: 'Church Treasurer',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Outline Pastoral Preaching Series on Stewardship',
            description:
              'Design 4-week liturgical preaching series aligning Sunday sermons, pastoral prayers, and scripture readings with gratitude and mission.',
            priority: 'MEDIUM',
            dueOffsetDays: 14,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Worship Committee',
              informed: 'Pastor of Worship',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Communications, Narrative & Pledge Cards',
        order: 1,
        tasks: [
          {
            title: 'Draft Senior Pastor’s Stewardship Pastoral Vision Letter',
            description:
              'Write heartfelt pastoral appeal grounding generosity in the grace of Christ and celebrating congregation ministry fruitfulness.',
            priority: 'HIGH',
            dueOffsetDays: 18,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Stewardship Chair',
              consulted: 'Communications Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Design & Print Narrative Budget Brochure and Pledge Cards',
            description:
              'Produce multi-page graphic narrative budget booklet and perforated pledge cards with confidential giving increments.',
            priority: 'HIGH',
            dueOffsetDays: 21,
            raci: {
              responsible: 'Communications Director',
              accountable: 'Stewardship Chair',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Configure Online Pledge Portal & Recurring Giving System',
            description:
              'Update church database pledge tracking module and online giving payment gateway for electronic pledge submissions.',
            priority: 'HIGH',
            dueOffsetDays: 25,
            raci: {
              responsible: 'Church Administrator',
              accountable: 'Finance Committee Chair',
              consulted: 'Church Treasurer',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Collate & Mail Physical Stewardship Packets to Member Households',
            description:
              'Assemble letter, narrative brochure, pledge card, and return envelope for postal mailing to all church families.',
            priority: 'HIGH',
            dueOffsetDays: 28,
            raci: {
              responsible: 'Parish Secretary',
              accountable: 'Church Administrator',
              informed: 'Stewardship Chair',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Congregational Stewardship Dinner',
        order: 2,
        tasks: [
          {
            title: 'Book Catering & Reserve Fellowship Hall for Stewardship Dinner',
            description:
              'Finalize banquet menu, dessert options, dining layout for 200 members, and audiovisual presentation projection.',
            priority: 'MEDIUM',
            dueOffsetDays: 11,
            raci: {
              responsible: 'Dinner Coordinator',
              accountable: 'Stewardship Chair',
              consulted: 'Facilities Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Recruit & Train 15 Table Hosts for Facilitated Ministry Sharing',
            description:
              'Brief table hosts on discussion prompts, welcoming newcomers, and sparking conversations on church impact and vision.',
            priority: 'HIGH',
            dueOffsetDays: 27,
            raci: {
              responsible: 'Stewardship Committee',
              accountable: 'Dinner Coordinator',
              consulted: 'Associate Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Produce 5-Minute Ministry Impact Video Presentation',
            description:
              'Film and edit congregational testimonies featuring youth, missions, local outreach, and pastoral care stories.',
            priority: 'HIGH',
            dueOffsetDays: 31,
            raci: {
              responsible: 'Media Producer',
              accountable: 'Communications Director',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Host Congregational Stewardship Dinner & Keynote Vision Cast',
            description:
              'Deliver inspiring evening of fellowship, table discussions, video premiere, and pastoral vision casting for the coming year.',
            priority: 'URGENT',
            dueOffsetDays: 35,
            raci: {
              responsible: 'Stewardship Chair',
              accountable: 'Senior Pastor',
              informed: 'Session of Elders',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Commitment Sunday & Pledge Collection',
        order: 3,
        tasks: [
          {
            title: 'Script Commitment Sunday Liturgy of Dedication & Temple Talks',
            description:
              'Craft pastoral prayer of thanksgiving, responsive litany, and schedule a 2-minute lay member testimony during worship.',
            priority: 'HIGH',
            dueOffsetDays: 33,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Pastor of Worship',
              consulted: 'Stewardship Chair',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Commitment Sunday Walk-Forward Offering of Pledges',
            description:
              'Collect physical pledge cards during worship dedication; offer prayer of consecration over the commitments.',
            priority: 'URGENT',
            dueOffsetDays: 42,
            raci: {
              responsible: 'Head Usher',
              accountable: 'Clerk of Session',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Securely Tally & Audit Commitment Sunday Pledge Returns',
            description:
              'Two unrelated financial counters audit, enter, and reconcile returned pledge totals into the church database.',
            priority: 'HIGH',
            dueOffsetDays: 44,
            raci: {
              responsible: 'Church Treasurer',
              accountable: 'Finance Committee Chair',
              informed: 'Stewardship Chair',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Follow-Up, Gratitude & Reporting',
        order: 4,
        tasks: [
          {
            title: 'Send Personalized Pastoral Thank-You Letters to Pledging Families',
            description:
              'Generate personalized acknowledgement letters signed by the pastoral staff thanking households for their faithful commitment.',
            priority: 'HIGH',
            dueOffsetDays: 46,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Stewardship Chair',
              informed: 'Church Administrator',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Gentle Pastoral Follow-Up with Uncommitted Member Households',
            description:
              'Reach out with pastoral warmth to households who may have missed Commitment Sunday with opportunity to participate.',
            priority: 'MEDIUM',
            dueOffsetDays: 48,
            raci: {
              responsible: 'Associate Pastor',
              accountable: 'Senior Pastor',
              consulted: 'Care Deacons',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Deliver Final Campaign Assessment Report to Session & Congregation',
            description:
              'Present final financial totals, pledge counts, and ministry projections to the Session; publish celebratory church update.',
            priority: 'HIGH',
            dueOffsetDays: 49,
            raci: {
              responsible: 'Stewardship Chair',
              accountable: 'Finance Committee Chair',
              informed: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'confirmation-inquirers',
    name: 'Inquirers & Confirmation Class',
    description:
      'A 10-week discipleship and formation pipeline guiding youth and adult inquirers through catechism, sponsor mentorship, elder interviews, faith statements, and baptism preparation.',
    category: 'Discipleship & Formation',
    estimatedWeeks: 10,
    icon: '🕊️',
    color: 'purple',
    sections: [
      {
        name: 'Course Planning & Cohort Recruitment',
        order: 0,
        tasks: [
          {
            title: 'Announce Confirmation / Inquirers Dates & Open Cohort Registration',
            description:
              'Promote class schedule in worship, youth group, and website; register youth (8th grade+) and adult inquirers.',
            priority: 'HIGH',
            dueOffsetDays: 0,
            raci: {
              responsible: 'Discipleship Pastor',
              accountable: 'Senior Pastor',
              informed: 'Youth Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Order Student Study Bibles, Catechism Guides & Journals',
            description:
              'Procure copies of the study Bible, Westminster Shorter Catechism / Heidelberg Catechism guides, and personal journals.',
            priority: 'MEDIUM',
            dueOffsetDays: 6,
            raci: {
              responsible: 'Education Administrator',
              accountable: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Host Confirmand & Parent Orientation Evening',
            description:
              'Review syllabus, attendance commitments, mentor requirements, service project, and schedule of elder interviews.',
            priority: 'HIGH',
            dueOffsetDays: 10,
            raci: {
              responsible: 'Discipleship Pastor',
              accountable: 'Youth Director',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Mentor & Sponsor Pairings',
        order: 1,
        tasks: [
          {
            title: 'Recruit Mature Church Elders & Members as Confirmand Sponsors',
            description:
              'Enlist faithful adult members and ruling elders to walk alongside each student as spiritual mentors and prayer partners.',
            priority: 'HIGH',
            dueOffsetDays: 12,
            raci: {
              responsible: 'Discipleship Pastor',
              accountable: 'Clerk of Session',
              consulted: 'Youth Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Sponsor Orientation on Mentoring & Active Listening',
            description:
              'Train sponsors on adolescent faith development, theological discussion questions, and safe sanctuary boundaries.',
            priority: 'MEDIUM',
            dueOffsetDays: 18,
            raci: {
              responsible: 'Discipleship Pastor',
              accountable: 'Youth Director',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Host Sponsor-Student Fellowship Breakfast & Prayer Covenant',
            description:
              'Host breakfast where students and sponsors meet, share personal faith journeys, and sign a mutual prayer covenant.',
            priority: 'MEDIUM',
            dueOffsetDays: 21,
            raci: {
              responsible: 'Youth Director',
              accountable: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Curriculum Sessions & Field Experience',
        order: 2,
        tasks: [
          {
            title: 'Facilitate Theological Foundations 1–4 (God, Scripture, Sin, Grace)',
            description:
              'Teach core doctrines of the Trinity, authority of Scripture, the human condition, and redemption in Jesus Christ.',
            priority: 'HIGH',
            dueOffsetDays: 28,
            raci: {
              responsible: 'Teaching Elder',
              accountable: 'Discipleship Pastor',
              consulted: 'Senior Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Execute Hands-On Local Mission Service Project',
            description:
              'Lead students and sponsors in serving at a local soup kitchen, crisis nursery, or church benevolence food pantry.',
            priority: 'MEDIUM',
            dueOffsetDays: 42,
            raci: {
              responsible: 'Missions Director',
              accountable: 'Youth Director',
              consulted: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Facilitate Christian Life Sessions 5–8 (Church, Sacraments, Discipleship)',
            description:
              'Teach the nature of the Reformed church, Baptism, the Lord’s Supper, prayer, and living as disciples in the world.',
            priority: 'HIGH',
            dueOffsetDays: 49,
            raci: {
              responsible: 'Teaching Elder',
              accountable: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Confirmation Retreat Weekend / Day of Reflection',
            description:
              'Host off-site retreat focusing on personal prayer, testimonies, spiritual disciplines, and group bonding.',
            priority: 'HIGH',
            dueOffsetDays: 54,
            raci: {
              responsible: 'Youth Pastor',
              accountable: 'Discipleship Pastor',
              consulted: 'Volunteer Sponsors',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Elder Interviews & Faith Statements',
        order: 3,
        tasks: [
          {
            title: 'Guide Students in Drafting Personal Statements of Faith (Credo)',
            description:
              'Assist each confirmand in articulating their personal faith in Christ, understanding of grace, and commitment to the church.',
            priority: 'HIGH',
            dueOffsetDays: 56,
            raci: {
              responsible: 'Youth Director',
              accountable: 'Discipleship Pastor',
              consulted: 'Volunteer Sponsors',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Schedule Session Meeting & Organize Elder Interview Panels',
            description:
              'Pair 2 ruling elders per student for 20-minute encouraging conversations reviewing their faith statements.',
            priority: 'HIGH',
            dueOffsetDays: 60,
            raci: {
              responsible: 'Clerk of Session',
              accountable: 'Senior Pastor',
              informed: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Conduct Elder Board Interviews & Vote to Receive into Membership',
            description:
              'Session convenes to hear confirmand testimonies, review faith statements, and vote formally to receive them as communing members.',
            priority: 'URGENT',
            dueOffsetDays: 65,
            raci: {
              responsible: 'Session of Elders',
              accountable: 'Senior Pastor',
              informed: 'Clerk of Session',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
      {
        name: 'Confirmation Sunday & Baptism Preparation',
        order: 4,
        tasks: [
          {
            title: 'Identify Unbaptized Confirmands & Conduct Baptismal Instruction',
            description:
              'Meet with candidates not yet baptized to explain the covenant sign and seal of Holy Baptism.',
            priority: 'HIGH',
            dueOffsetDays: 63,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Associate Pastor',
              informed: 'Clerk of Session',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Order Confirmation Bibles, Certificates & Lapel Boutonnieres',
            description:
              'Engrave student names on commemorative Bibles, prepare official Session membership certificates, and order red carnation boutonnieres.',
            priority: 'MEDIUM',
            dueOffsetDays: 64,
            raci: {
              responsible: 'Church Administrator',
              accountable: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Rehearse Confirmation Liturgy & Laying on of Hands',
            description:
              'Sanctuary rehearsal of processional, covenant vows, public question answering, and elder laying on of hands.',
            priority: 'HIGH',
            dueOffsetDays: 68,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Pastor of Worship',
              consulted: 'Discipleship Pastor',
              primaryRole: 'RESPONSIBLE',
            },
          },
          {
            title: 'Celebrate Confirmation Sunday Worship & Fellowship Reception',
            description:
              'Administer vows of membership, holy baptisms, prayer of blessing, presentation of Bibles, followed by church-wide celebration cake reception.',
            priority: 'URGENT',
            dueOffsetDays: 70,
            raci: {
              responsible: 'Senior Pastor',
              accountable: 'Session of Elders',
              consulted: 'Hospitality Team',
              primaryRole: 'RESPONSIBLE',
            },
          },
        ],
      },
    ],
  },
];

export function listMinistryPlaybooks(): MinistryPlaybook[] {
  return MINISTRY_PLAYBOOKS;
}

export function getMinistryPlaybook(playbookId: string): MinistryPlaybook | undefined {
  return MINISTRY_PLAYBOOKS.find((p) => p.id === playbookId);
}

export interface InstantiatePlaybookOptions {
  projectName?: string;
  description?: string;
  userId?: string;
}

export interface InstantiatePlaybookResult {
  success: boolean;
  error?: string;
  projectId?: string;
  taskCount?: number;
  sectionCount?: number;
  raciChartId?: string;
}

/**
 * Instantiates a Ministry Playbook into an active Project with its Sections and Tasks
 * with due dates and start dates computed relative to `startDate`.
 */
export async function instantiatePlaybook(
  playbookId: string,
  startDate: Date | string,
  options: InstantiatePlaybookOptions = {}
): Promise<InstantiatePlaybookResult> {
  const playbook = getMinistryPlaybook(playbookId);
  if (!playbook) {
    return { success: false, error: `Playbook "${playbookId}" not found.` };
  }

  const parsedStartDate = typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
  if (isNaN(parsedStartDate.getTime())) {
    return { success: false, error: 'Invalid start date provided.' };
  }

  let effectiveUserId = options.userId;
  if (!effectiveUserId) {
    try {
      const session = await getServerSession(authOptions);
      effectiveUserId = session?.user?.id;
    } catch {
      // Allow passing explicit userId in tests or when session is not available
    }
  }

  if (!effectiveUserId) {
    return { success: false, error: 'User must be authenticated to instantiate a playbook.' };
  }

  const projectName = options.projectName?.trim() || `${playbook.name} (${parsedStartDate.getFullYear()})`;
  const projectDescription = options.description?.trim() || playbook.description;

  // Use a Prisma transaction to reliably generate the project, sections, and tasks
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Project
    const project = await tx.project.create({
      data: {
        name: projectName,
        description: projectDescription,
        createdById: effectiveUserId!,
        members: {
          create: [{ userId: effectiveUserId!, isManager: true }],
        },
      },
    });

    let totalTasks = 0;

    // 2. Create Sections & Tasks
    for (const secTemplate of playbook.sections) {
      const section = await tx.section.create({
        data: {
          name: secTemplate.name,
          order: secTemplate.order,
          projectId: project.id,
        },
      });

      for (let i = 0; i < secTemplate.tasks.length; i++) {
        const taskTemplate = secTemplate.tasks[i];
        const taskDueDate = addDays(parsedStartDate, taskTemplate.dueOffsetDays);
        const taskStartDate =
          taskTemplate.startOffsetDays !== undefined
            ? addDays(parsedStartDate, taskTemplate.startOffsetDays)
            : undefined;

        // Build rich markdown description embedding the RACI Matrix
        const raciLines = [
          `**RACI Matrix:**`,
          `- **Responsible (R):** ${taskTemplate.raci.responsible}`,
          `- **Accountable (A):** ${taskTemplate.raci.accountable}`,
          taskTemplate.raci.consulted ? `- **Consulted (C):** ${taskTemplate.raci.consulted}` : null,
          taskTemplate.raci.informed ? `- **Informed (I):** ${taskTemplate.raci.informed}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        const richDescription = `${taskTemplate.description}\n\n${raciLines}`;

        const createdTask = await tx.task.create({
          data: {
            title: taskTemplate.title,
            description: richDescription,
            projectId: project.id,
            sectionId: section.id,
            priority: taskTemplate.priority,
            status: 'TODO',
            startDate: taskStartDate,
            dueDate: taskDueDate,
            order: i,
          },
        });
        totalTasks++;

        // Create subtasks if defined
        if (taskTemplate.subtasks && taskTemplate.subtasks.length > 0) {
          for (let s = 0; s < taskTemplate.subtasks.length; s++) {
            const sub = taskTemplate.subtasks[s];
            const subDueDate =
              sub.dueOffsetDays !== undefined
                ? addDays(parsedStartDate, sub.dueOffsetDays)
                : taskDueDate;

            await tx.task.create({
              data: {
                title: sub.title,
                description: sub.description || null,
                projectId: project.id,
                sectionId: section.id,
                parentTaskId: createdTask.id,
                priority: sub.priority ?? taskTemplate.priority,
                status: 'TODO',
                dueDate: subDueDate,
                order: s,
              },
            });
            totalTasks++;
          }
        }
      }
    }

    // 3. Optional: If RACI module is enabled, create linked RACI chart
    let createdChartId: string | undefined;
    if (isModuleEnabled('raci') && (tx as any).raciChart) {
      try {
        const chart = await (tx as any).raciChart.create({
          data: {
            processName: `${projectName} RACI`,
            owner: playbook.name,
            trigger: `Instantiation of ${playbook.name}`,
            description: `RACI Matrix for ${playbook.name} starting ${parsedStartDate.toISOString().slice(0, 10)}`,
            ministryArea: playbook.category,
            isPublic: true,
            tags: [playbook.id, 'playbook'],
            createdById: effectiveUserId!,
          },
        });
        createdChartId = chart.id;
      } catch {
        // RACI chart creation is secondary; gracefully continue if not applicable
      }
    }

    return {
      projectId: project.id,
      taskCount: totalTasks,
      sectionCount: playbook.sections.length,
      raciChartId: createdChartId,
    };
  });

  try {
    revalidatePath('/projects');
    revalidatePath(`/projects/${result.projectId}`);
  } catch {
    // In unit test environments revalidatePath might be a mock or no-op
  }

  return {
    success: true,
    projectId: result.projectId,
    taskCount: result.taskCount,
    sectionCount: result.sectionCount,
    raciChartId: result.raciChartId,
  };
}

