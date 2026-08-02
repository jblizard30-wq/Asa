import { PrismaClient, Priority, TaskStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUser(name: string, email: string, role: Role, password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { role },
    create: { name, email, passwordHash, role },
  });
}

async function main() {
  console.log('Seeding database...');

  const pastor = await upsertUser('Pastor Dan Whitfield', 'pastor.dan@example.org', Role.ADMIN);
  const officeManager = await upsertUser('Renee Ortiz', 'renee.ortiz@example.org', Role.MANAGER);
  const facilitiesLead = await upsertUser('Miguel Alvarez', 'miguel.alvarez@example.org', Role.USER);
  const youthPastor = await upsertUser('Casey Nguyen', 'casey.nguyen@example.org', Role.USER);
  const volunteer = await upsertUser('Sarah Kim', 'sarah.kim@example.org', Role.USER);

  const allUsers = [pastor, officeManager, facilitiesLead, youthPastor, volunteer];

  // ---- Team: Renee manages facilities + hospitality volunteers ----
  let hospitalityTeam = await prisma.team.findUnique({ where: { name: 'Facilities & Hospitality' } });
  if (!hospitalityTeam) {
    hospitalityTeam = await prisma.team.create({
      data: {
        name: 'Facilities & Hospitality',
        managerId: officeManager.id,
        members: {
          create: [facilitiesLead, volunteer].map((u) => ({ userId: u.id })),
        },
      },
    });
    console.log('Created team "Facilities & Hospitality" managed by Renee Ortiz.');
  }

  // ---- Project 1: Sunday Service Planning ----
  let serviceProject = await prisma.project.findFirst({
    where: { name: 'Sunday Service Planning' },
    include: { sections: true },
  });

  if (!serviceProject) {
    serviceProject = await prisma.project.create({
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
  }

  // ---- Project 2: Facilities & Maintenance ----
  let facilitiesProject = await prisma.project.findFirst({
    where: { name: 'Facilities & Maintenance' },
    include: { sections: true },
  });

  if (!facilitiesProject) {
    facilitiesProject = await prisma.project.create({
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
  }

  // ---- Project 3: Youth Ministry Events ----
  let youthProject = await prisma.project.findFirst({
    where: { name: 'Youth Ministry Events' },
    include: { sections: true },
  });

  if (!youthProject) {
    youthProject = await prisma.project.create({
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
          title: 'Recruit adult chaperones',
          description: 'Need 4 background-checked volunteers for the retreat.',
          projectId: youthProject.id,
          sectionId: youthTodo.id,
          assigneeId: volunteer.id,
          dueDate: nextDaysFromNow(9),
          priority: Priority.MEDIUM,
          status: TaskStatus.TODO,
          order: 4,
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
  }

  // ---- Sequential branching demo (independent of whether the project above was just created) ----
  const existingChainTask = await prisma.task.findFirst({
    where: { projectId: youthProject.id, title: 'Book venue for fall retreat' },
  });

  if (!existingChainTask) {
    const youthTodoSection = await prisma.section.findFirstOrThrow({
      where: { projectId: youthProject.id, name: 'To Do' },
    });

    const bookVenue = await prisma.task.create({
      data: {
        title: 'Book venue for fall retreat',
        description: 'Confirm dates and deposit for Camp Wildwood, Oct 17–19.',
        projectId: youthProject.id,
        sectionId: youthTodoSection.id,
        assigneeId: youthPastor.id,
        dueDate: nextDaysFromNow(14),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        order: 10,
      },
    });

    // The deposit can't be confirmed until the venue is booked, and once it's
    // confirmed, chairs and tables can be ordered in parallel — one predecessor,
    // two branching successors.
    const confirmDeposit = await prisma.task.create({
      data: {
        title: 'Confirm retreat deposit paid',
        description: 'Verify the venue deposit cleared before ordering any rentals.',
        projectId: youthProject.id,
        sectionId: youthTodoSection.id,
        assigneeId: youthPastor.id,
        predecessorId: bookVenue.id,
        dueDate: nextDaysFromNow(16),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        order: 11,
      },
    });

    await prisma.task.createMany({
      data: [
        {
          title: 'Order chairs for retreat hall',
          description: 'Rent 120 folding chairs — only after the deposit is confirmed.',
          projectId: youthProject.id,
          sectionId: youthTodoSection.id,
          assigneeId: volunteer.id,
          predecessorId: confirmDeposit.id,
          dueDate: nextDaysFromNow(18),
          priority: Priority.MEDIUM,
          status: TaskStatus.TODO,
          order: 12,
        },
        {
          title: 'Order tables for retreat hall',
          description: 'Rent 15 folding tables — only after the deposit is confirmed.',
          projectId: youthProject.id,
          sectionId: youthTodoSection.id,
          assigneeId: volunteer.id,
          predecessorId: confirmDeposit.id,
          dueDate: nextDaysFromNow(18),
          priority: Priority.MEDIUM,
          status: TaskStatus.TODO,
          order: 13,
        },
      ],
    });

    console.log('Created sequential task chain demo in Youth Ministry Events.');
  }

  // ---- Reminder demo (Renee, a manager, nudges her team member Sarah) ----
  const existingReminder = await prisma.reminder.findFirst({ where: { senderId: officeManager.id, recipientId: volunteer.id } });
  if (!existingReminder) {
    await prisma.reminder.create({
      data: {
        recipientId: volunteer.id,
        senderId: officeManager.id,
        message: 'Just checking in — were you able to line up chaperones for the fall retreat yet?',
      },
    });
    console.log('Created reminder demo from Renee to Sarah.');
  }

  console.log('Seed complete. Sample login: pastor.dan@example.org / password123');
  console.log(`Seeded ${allUsers.length} users.`);
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
