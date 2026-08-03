import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(name: string, email: string, role: Role = Role.USER, password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { name, email, passwordHash, role },
  });
}

// Section blueprint: each entry is a swimlane in the Bulletin flowchart.
// Each task may carry `subtasks` (nested one level, matching the PDF's bullet indentation)
// and an optional `assignee` key resolved against the `users` map below.
type TaskBlueprint = {
  title: string;
  description?: string;
  assignee?: string;
  subtasks?: { title: string }[];
};

type SectionBlueprint = {
  name: string;
  tasks: TaskBlueprint[];
};

async function main() {
  console.log('Seeding Bulletin template...');

  const justin = await prisma.user.findUnique({ where: { email: 'justinb@chespres.org' } });
  if (!justin) throw new Error('Expected existing user justinb@chespres.org (Bliz) not found.');

  const users = {
    bliz: justin,
    kristen: await upsertUser('Kristen', 'kristen@chespres.org'),
    marybeth: await upsertUser('MaryBeth', 'marybeth@chespres.org'),
    lydia: await upsertUser('Lydia', 'lydia@chespres.org'),
    hugh: await upsertUser('Hugh', 'hugh@chespres.org'),
    owen: await upsertUser('Owen', 'owen@chespres.org'),
    tony: await upsertUser('Tony', 'tony@chespres.org'),
    adamD: await upsertUser('Adam D', 'adamd@chespres.org'),
    justinH: await upsertUser('Justin H', 'justinh@chespres.org'),
    cj: await upsertUser('CJ', 'cj@chespres.org'),
    mitch: await upsertUser('Mitch', 'mitch@chespres.org'),
    heather: await upsertUser('Heather', 'heather@chespres.org'),
    ellie: await upsertUser('Ellie', 'ellie@chespres.org'),
    lynn: await upsertUser('Lynn', 'lynn@chespres.org'),
    abigail: await upsertUser('Abigail', 'abigail@chespres.org'),
  };
  console.log(`Upserted ${Object.keys(users).length} users (placeholder @chespres.org emails, password123).`);

  // ---- Folder: Bulletins ----
  let folder = await prisma.projectFolder.findUnique({
    where: { userId_name: { userId: justin.id, name: 'Bulletins' } },
  });
  if (!folder) {
    const maxOrder = await prisma.projectFolder.aggregate({
      where: { userId: justin.id },
      _max: { order: true },
    });
    folder = await prisma.projectFolder.create({
      data: { name: 'Bulletins', userId: justin.id, order: (maxOrder._max.order ?? -1) + 1 },
    });
    console.log('Created folder "Bulletins".');
  }

  // ---- Project: Bulletin ----
  let project = await prisma.project.findFirst({ where: { name: 'Bulletin', createdById: justin.id } });
  const isNewProject = !project;
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Bulletin',
        description: 'Weekly bulletin production workflow: worship planning, sermon prep, sacraments, graphics, admin entry, and the two review/proof passes before printing.',
        createdById: justin.id,
        members: { create: Object.values(users).map((u) => ({ userId: u.id })) },
      },
    });
    console.log('Created project "Bulletin".');
  }

  const existingFolderItem = await prisma.projectFolderItem.findUnique({
    where: { folderId_projectId: { folderId: folder.id, projectId: project.id } },
  });
  if (!existingFolderItem) {
    const maxItemOrder = await prisma.projectFolderItem.aggregate({
      where: { folderId: folder.id },
      _max: { order: true },
    });
    await prisma.projectFolderItem.create({
      data: { folderId: folder.id, projectId: project.id, order: (maxItemOrder._max.order ?? -1) + 1 },
    });
    console.log('Added project "Bulletin" to folder "Bulletins".');
  }

  if (!isNewProject) {
    console.log('Project "Bulletin" already existed — skipping section/task creation to avoid duplicates.');
    return;
  }

  const POOL_NOTE = (names: string) => `Pool for this role: ${names}. Assign whoever is serving that week.`;

  const sections: SectionBlueprint[] = [
    {
      name: 'Communications',
      tasks: [
        { title: 'Schedule Announcements', description: POOL_NOTE('Tony, Lynn, Bliz') },
        { title: 'Create/Obtain Graphics', description: POOL_NOTE('Tony, Lynn, Bliz') },
      ],
    },
    {
      name: 'Worship',
      tasks: [
        {
          title: 'Order of Worship (Sat. & Sun.)',
          description: POOL_NOTE('Hugh, Tony, Heather'),
          subtasks: [
            { title: 'Call to Worship Text' },
            { title: 'Call to Confession Text' },
            { title: 'Assurance of Pardon Text' },
            { title: 'Music' },
            { title: 'Song Names' },
          ],
        },
      ],
    },
    {
      name: 'Preacher',
      tasks: [
        { title: 'Sermon Text', description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H, CJ, Mitch, Guest') },
        { title: 'Sermon Title', description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H, CJ, Mitch, Guest') },
        { title: 'Sermon Questions', description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H, CJ, Mitch, Guest') },
        { title: 'Designate Benedictor', description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H, CJ, Mitch, Guest') },
      ],
    },
    {
      name: 'Sacraments',
      tasks: [
        {
          title: 'Lord’s Supper Reminder (First Sunday Each Month)',
          description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H'),
        },
        {
          title: 'Submit Names of Baptism Recipients',
          description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H'),
        },
        {
          title: 'Baptism',
          description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H'),
          subtasks: [{ title: 'Communicate Time of Baptism' }, { title: 'Designate Prayer Person' }],
        },
        {
          title: 'Lord’s Supper Preparation',
          description: POOL_NOTE('Hugh, Owen, Tony, Adam D, Justin H'),
          subtasks: [{ title: 'Session Approval' }, { title: 'Designate Prayer Person' }],
        },
      ],
    },
    {
      name: 'Worship Director',
      tasks: [
        {
          title: 'Create Slides',
          subtasks: [{ title: 'Songs' }, { title: 'Announcements' }, { title: 'Stock Images' }],
        },
      ],
    },
    {
      name: 'Liturgist',
      tasks: [
        { title: 'Review Order of Worship', description: POOL_NOTE('Owen, Tony, Adam D, Justin H, CJ, Mitch') },
        { title: 'Review Announcements', description: POOL_NOTE('Owen, Tony, Adam D, Justin H, CJ, Mitch') },
        { title: 'Plan Script', description: POOL_NOTE('Owen, Tony, Adam D, Justin H, CJ, Mitch') },
      ],
    },
    {
      name: 'Children’s Bulletin',
      tasks: [
        { title: 'Obtain Sermon Info', assignee: 'abigail' },
        { title: 'Create Children’s Bulletin', assignee: 'abigail' },
      ],
    },
    {
      name: 'Internet',
      tasks: [
        { title: 'Sermon Questions onto Web/App', assignee: 'bliz' },
        { title: 'Live Stream Reviewed', description: 'Diagram marks this "Tony/Owen (?)" — unconfirmed, assign manually.' },
      ],
    },
    {
      name: 'Admin',
      tasks: [
        {
          title: 'Input Data into Bulletin',
          description: POOL_NOTE('Kristen, MaryBeth, Lydia, Other'),
          subtasks: [{ title: 'Saturday' }, { title: 'Sunday' }],
        },
        {
          title: 'Submit Bulletin for Review',
          description: POOL_NOTE('Kristen, MaryBeth, Lydia, Other'),
          subtasks: [{ title: 'Saturday' }, { title: 'Sunday' }],
        },
        { title: 'Print Children’s Bulletin', description: POOL_NOTE('Kristen, MaryBeth, Lydia, Other') },
        { title: 'Print', description: POOL_NOTE('Kristen, MaryBeth, Lydia, Other') },
      ],
    },
    {
      name: 'Heather Review',
      tasks: [
        {
          title: 'Audit Order & Songs',
          assignee: 'heather',
          subtasks: [{ title: 'Audit Order' }, { title: 'Audit Songs' }],
        },
      ],
    },
    {
      name: 'Lynn Review',
      tasks: [
        { title: 'Full Proof — Children’s Bulletin', assignee: 'lynn' },
        { title: 'Full Proof — Main Bulletin', assignee: 'lynn' },
      ],
    },
  ];

  for (let sectionOrder = 0; sectionOrder < sections.length; sectionOrder++) {
    const sectionBlueprint = sections[sectionOrder];
    const section = await prisma.section.create({
      data: { name: sectionBlueprint.name, projectId: project.id, order: sectionOrder },
    });

    for (let taskOrder = 0; taskOrder < sectionBlueprint.tasks.length; taskOrder++) {
      const taskBlueprint = sectionBlueprint.tasks[taskOrder];
      const assigneeId = taskBlueprint.assignee ? users[taskBlueprint.assignee as keyof typeof users].id : null;

      const mainTask = await prisma.task.create({
        data: {
          title: taskBlueprint.title,
          description: taskBlueprint.description,
          projectId: project.id,
          sectionId: section.id,
          assigneeId,
          order: taskOrder,
        },
      });

      if (taskBlueprint.subtasks) {
        for (let subOrder = 0; subOrder < taskBlueprint.subtasks.length; subOrder++) {
          await prisma.task.create({
            data: {
              title: taskBlueprint.subtasks[subOrder].title,
              projectId: project.id,
              sectionId: section.id,
              parentTaskId: mainTask.id,
              assigneeId,
              order: subOrder,
            },
          });
        }
      }
    }

    console.log(`Created section "${sectionBlueprint.name}" with ${sectionBlueprint.tasks.length} main task(s).`);
  }

  console.log('Bulletin template seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
