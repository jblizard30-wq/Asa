import { PrismaClient, Priority, TaskStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(name: string, email: string, role: Role, password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role },
  });
}

async function main() {
  console.log('Seeding database...');

  const pastor = await upsertUser('Pastor Dan Whitfield', 'pastor.dan@example.org', Role.ADMIN);
  const officeManager = await upsertUser('Renee Ortiz', 'renee.ortiz@example.org', Role.STAFF);
  const facilitiesLead = await upsertUser('Miguel Alvarez', 'miguel.alvarez@example.org', Role.STAFF);
  const youthPastor = await upsertUser('Casey Nguyen', 'casey.nguyen@example.org', Role.STAFF);
  const volunteer = await upsertUser('Sarah Kim', 'sarah.kim@example.org', Role.VOLUNTEER);

  const allUsers = [pastor, officeManager, facilitiesLead, youthPastor, volunteer];

  // ---- Project 1: Sunday Service Planning ----
  const serviceProject = await prisma.project.create({
    data: {
      name: 'Sunday Service Planning',
      description: 'Weekly worship service logistics, from song selection to greeter scheduling.',
      createdById: pastor.id,
      members: {
        create: [pastor, officeManager, volunteer].map((u) => ({ userId: u.id })),
      },
      sections: {
        create: [
          { name: 'To Do', order: 0 },
          { name: 'In Progress', order: 1 },
          { name: 'Done', order: 2 },
        ],
      },
    },
    include: { sections: true },
  });

  const [svcTodo, svcInProgress, svcDone] = serviceProject.sections.sort((a, b) => a.order - b.order);

  await prisma.task.createMany({
    data: [
      {
        title: 'Finalize worship song set for Sunday',
        description: 'Confirm 4 songs with the worship team and share chord charts.',
        projectId: serviceProject.id,
        sectionId: svcTodo.id,
        assigneeId: officeManager.id,
        dueDate: nextDaysFromNow(3),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        order: 0,
      },
      {
        title: 'Schedule greeters and ushers',
        description: 'Fill all 6 greeter slots for the 9am and 11am services.',
        projectId: serviceProject.id,
        sectionId: svcTodo.id,
        assigneeId: volunteer.id,
        dueDate: nextDaysFromNow(2),
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
        order: 1,
      },
      {
        title: 'Prepare sermon slides',
        description: 'Build slide deck from Pastor Dan’s outline for this week’s message.',
        projectId: serviceProject.id,
        sectionId: svcInProgress.id,
        assigneeId: pastor.id,
        dueDate: nextDaysFromNow(1),
        priority: Priority.URGENT,
        status: TaskStatus.IN_PROGRESS,
        order: 0,
      },
      {
        title: 'Print bulletins',
        description: 'Order 300 copies from the church printer for Sunday.',
        projectId: serviceProject.id,
        sectionId: svcDone.id,
        assigneeId: officeManager.id,
        dueDate: nextDaysFromNow(-1),
        priority: Priority.LOW,
        status: TaskStatus.DONE,
        order: 0,
      },
    ],
  });

  // ---- Project 2: Facilities & Maintenance ----
  const facilitiesProject = await prisma.project.create({
    data: {
      name: 'Facilities & Maintenance',
      description: 'Building upkeep, repairs, and safety checks across campus.',
      createdById: pastor.id,
      members: {
        create: [pastor, facilitiesLead, volunteer].map((u) => ({ userId: u.id })),
      },
      sections: {
        create: [
          { name: 'To Do', order: 0 },
          { name: 'In Progress', order: 1 },
          { name: 'Done', order: 2 },
        ],
      },
    },
    include: { sections: true },
  });

  const [facTodo, facInProgress, facDone] = facilitiesProject.sections.sort((a, b) => a.order - b.order);

  await prisma.task.createMany({
    data: [
      {
        title: 'Replace fellowship hall light fixtures',
        description: 'Three fluorescent fixtures are flickering — swap to LED panels.',
        projectId: facilitiesProject.id,
        sectionId: facTodo.id,
        assigneeId: facilitiesLead.id,
        dueDate: nextDaysFromNow(7),
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
        order: 0,
      },
      {
        title: 'Quarterly fire extinguisher inspection',
        description: 'Check pressure gauges and expiration tags in all buildings.',
        projectId: facilitiesProject.id,
        sectionId: facTodo.id,
        assigneeId: facilitiesLead.id,
        dueDate: nextDaysFromNow(10),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        order: 1,
      },
      {
        title: 'Repair leaking sink in kids’ wing restroom',
        description: 'Plumber scheduled — confirm access with facilities lead.',
        projectId: facilitiesProject.id,
        sectionId: facInProgress.id,
        assigneeId: facilitiesLead.id,
        dueDate: nextDaysFromNow(2),
        priority: Priority.URGENT,
        status: TaskStatus.IN_PROGRESS,
        order: 0,
      },
      {
        title: 'Mow and edge front lawn',
        description: 'Weekly groundskeeping before Sunday service.',
        projectId: facilitiesProject.id,
        sectionId: facDone.id,
        assigneeId: volunteer.id,
        dueDate: nextDaysFromNow(-2),
        priority: Priority.LOW,
        status: TaskStatus.DONE,
        order: 0,
      },
    ],
  });

  // ---- Project 3: Youth Ministry Events ----
  const youthProject = await prisma.project.create({
    data: {
      name: 'Youth Ministry Events',
      description: 'Planning for youth group gatherings, retreats, and outreach nights.',
      createdById: youthPastor.id,
      members: {
        create: [pastor, youthPastor, volunteer].map((u) => ({ userId: u.id })),
      },
      sections: {
        create: [
          { name: 'To Do', order: 0 },
          { name: 'In Progress', order: 1 },
          { name: 'Done', order: 2 },
        ],
      },
    },
    include: { sections: true },
  });

  const [youthTodo, youthInProgress, youthDone] = youthProject.sections.sort((a, b) => a.order - b.order);

  await prisma.task.createMany({
    data: [
      {
        title: 'Book venue for fall retreat',
        description: 'Confirm dates and deposit for Camp Wildwood, Oct 17–19.',
        projectId: youthProject.id,
        sectionId: youthTodo.id,
        assigneeId: youthPastor.id,
        dueDate: nextDaysFromNow(14),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        order: 0,
      },
      {
        title: 'Recruit adult chaperones',
        description: 'Need 4 background-checked volunteers for the retreat.',
        projectId: youthProject.id,
        sectionId: youthTodo.id,
        assigneeId: volunteer.id,
        dueDate: nextDaysFromNow(9),
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
        order: 1,
      },
      {
        title: 'Design flyer for game night',
        description: 'Promote Friday game night on social media and bulletin board.',
        projectId: youthProject.id,
        sectionId: youthInProgress.id,
        assigneeId: volunteer.id,
        dueDate: nextDaysFromNow(4),
        priority: Priority.LOW,
        status: TaskStatus.IN_PROGRESS,
        order: 0,
      },
      {
        title: 'Order pizza for last game night',
        description: 'Vendor confirmed, order picked up on time.',
        projectId: youthProject.id,
        sectionId: youthDone.id,
        assigneeId: youthPastor.id,
        dueDate: nextDaysFromNow(-5),
        priority: Priority.LOW,
        status: TaskStatus.DONE,
        order: 0,
      },
    ],
  });

  console.log('Seed complete. Sample login: pastor.dan@example.org / password123');
  console.log(`Seeded ${allUsers.length} users and 3 projects.`);
}

function nextDaysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
