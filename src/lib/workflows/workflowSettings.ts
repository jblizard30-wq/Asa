'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export interface WorkflowRoleSettings {
  inventoryOrdererId: string | null;
  inventoryDeliveryId: string | null;
  packetSecretaryId: string | null;
  defaultOperationsProjectId: string | null;
}

const SETTING_KEY = 'cross_module_workflow_roles';

export async function getWorkflowRoleSettings(): Promise<WorkflowRoleSettings> {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (!admin) {
      return {
        inventoryOrdererId: null,
        inventoryDeliveryId: null,
        packetSecretaryId: null,
        defaultOperationsProjectId: null,
      };
    }

    const pref = await prisma.notificationPreference.findFirst({
      where: { userId: admin.id },
    });

    // We can also find default users if unset
    const [firstAdmin, facilitiesUser, secretaryUser] = await Promise.all([
      prisma.user.findFirst({ where: { role: 'ADMIN' } }),
      prisma.user.findFirst({
        where: {
          OR: [
            { name: { contains: 'Facilities', mode: 'insensitive' } },
            { email: { contains: 'facilities', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.user.findFirst({
        where: {
          OR: [
            { name: { contains: 'Secretary', mode: 'insensitive' } },
            { name: { contains: 'Admin', mode: 'insensitive' } },
            { email: { contains: 'admin', mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    const defaultProject = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: 'Operations', mode: 'insensitive' } },
          { name: { contains: 'Facilities', mode: 'insensitive' } },
        ],
      },
    });

    return {
      inventoryOrdererId: firstAdmin?.id || null,
      inventoryDeliveryId: facilitiesUser?.id || firstAdmin?.id || null,
      packetSecretaryId: secretaryUser?.id || firstAdmin?.id || null,
      defaultOperationsProjectId: defaultProject?.id || null,
    };
  } catch (err) {
    console.error('Error fetching workflow settings:', err);
    return {
      inventoryOrdererId: null,
      inventoryDeliveryId: null,
      packetSecretaryId: null,
      defaultOperationsProjectId: null,
    };
  }
}

export async function getEligibleWorkflowUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function getEligibleWorkflowProjects() {
  return prisma.project.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });
}
