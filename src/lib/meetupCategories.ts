// src/lib/meetupCategories.ts
import { MeetupCategory } from '@prisma/client';

export type CategoryGroup = 'work' | 'ministry';

export interface MeetupCategoryMeta {
  value: MeetupCategory;
  label: string;
  group: CategoryGroup;
  description: string;
  defaultDurationMinutes: number;
  iconName: string;
  badgeClass: string;
  isPotluckDefault: boolean;
}

export const MEETUP_CATEGORIES: MeetupCategoryMeta[] = [
  // Work & Governance
  {
    value: 'STAFF_MEETING',
    label: 'Staff Meeting',
    group: 'work',
    description: 'Weekly team check-ins, all-hands, and staff coordination',
    defaultDurationMinutes: 60,
    iconName: 'briefcase',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    isPotluckDefault: false,
  },
  {
    value: 'ONE_ON_ONE',
    label: '1-on-1 / Check-in',
    group: 'work',
    description: 'Supervisory check-in, pastoral care, mentoring, or debrief',
    defaultDurationMinutes: 45,
    iconName: 'user-check',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    isPotluckDefault: false,
  },
  {
    value: 'BOARD_COMMITTEE',
    label: 'Board & Committee',
    group: 'work',
    description: 'Elder Session, Deacon board, Trustees, or Finance committee',
    defaultDurationMinutes: 90,
    iconName: 'shield-check',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    isPotluckDefault: false,
  },
  {
    value: 'STRATEGY_PLANNING',
    label: 'Strategy & Planning',
    group: 'work',
    description: 'Quarterly roadmap, departmental budget, or vision session',
    defaultDurationMinutes: 120,
    iconName: 'compass',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    isPotluckDefault: false,
  },
  {
    value: 'WORKING_SESSION',
    label: 'Working Session / Sprint',
    group: 'work',
    description: 'Hands-on focus block, creative review, or project execution',
    defaultDurationMinutes: 90,
    iconName: 'zap',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    isPotluckDefault: false,
  },

  // Ministry & Fellowship
  {
    value: 'MINISTRY_HANGOUT',
    label: 'Ministry Hangout / Fellowship',
    group: 'ministry',
    description: 'Team bonding, small group hangout, or volunteer appreciation',
    defaultDurationMinutes: 120,
    iconName: 'coffee',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    isPotluckDefault: false,
  },
  {
    value: 'VOLUNTEER_TRAINING',
    label: 'Volunteer Training',
    group: 'ministry',
    description: 'Welcome team, safety team, acolyte, or hospitality training',
    defaultDurationMinutes: 60,
    iconName: 'award',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    isPotluckDefault: false,
  },
  {
    value: 'WORSHIP_REHEARSAL',
    label: 'Worship Rehearsal / Tech',
    group: 'ministry',
    description: 'Music practice, soundcheck, and broadcast walkthrough',
    defaultDurationMinutes: 75,
    iconName: 'music',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    isPotluckDefault: false,
  },
  {
    value: 'RETREAT_OFFSITE',
    label: 'Retreat / Offsite',
    group: 'ministry',
    description: 'All-day or weekend leadership getaway and spiritual renewal',
    defaultDurationMinutes: 240,
    iconName: 'trees',
    badgeClass: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800',
    isPotluckDefault: false,
  },
  {
    value: 'POTLUCK_SOCIAL',
    label: 'Potluck & Fellowship Meal',
    group: 'ministry',
    description: 'Shared community meal, church picnic, or celebration dinner',
    defaultDurationMinutes: 120,
    iconName: 'utensils',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    isPotluckDefault: true,
  },
  {
    value: 'GENERAL',
    label: 'General Meetup',
    group: 'work',
    description: 'General gathering or meeting',
    defaultDurationMinutes: 60,
    iconName: 'calendar',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    isPotluckDefault: false,
  },
];

export const CATEGORY_MAP: Record<MeetupCategory, MeetupCategoryMeta> = MEETUP_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.value] = item;
    return acc;
  },
  {} as Record<MeetupCategory, MeetupCategoryMeta>,
);

export const DEFAULT_WORK_ROLES = [
  { title: 'Meeting Scribe / Note Taker', category: 'Role', capacity: 1 },
  { title: 'Discussion Facilitator / Timekeeper', category: 'Role', capacity: 1 },
  { title: 'Tech & Screen Share / AV Host', category: 'Role', capacity: 1 },
  { title: 'Hospitality / Coffee & Water', category: 'Role', capacity: 1 },
];

export const DEFAULT_POTLUCK_ITEMS = [
  { title: 'Main Entrée / Casserole', category: 'Food', capacity: 4 },
  { title: 'Side Dishes & Fresh Salads', category: 'Food', capacity: 4 },
  { title: 'Desserts & Baked Goods', category: 'Food', capacity: 3 },
  { title: 'Beverages, Juice & Ice', category: 'Drinks', capacity: 3 },
  { title: 'Paper Plates, Napkins & Cutlery', category: 'Supplies', capacity: 2 },
];

export const DEFAULT_SUNDAY_WORSHIP_ROLES = [
  { title: 'Liturgist / Scripture Reader', category: 'Liturgy', capacity: 1 },
  { title: 'Audio / Soundboard Engineer', category: 'AV Tech', capacity: 1 },
  { title: 'Visuals / Projection & Livestream', category: 'AV Tech', capacity: 1 },
  { title: 'Lead Usher / Greeter', category: 'Hospitality', capacity: 2 },
  { title: 'Communion Preparer / Server', category: 'Liturgy', capacity: 2 },
  { title: 'Nursery / Children Check-in', category: 'Family', capacity: 2 },
];


