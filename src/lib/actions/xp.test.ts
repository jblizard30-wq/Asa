import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'user-xp', role: 'ADMIN', name: 'Executive Pastor', email: 'xp@example.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  xpEnabled: true,
  frameworks: new Map<string, any>(),
  packets: new Map<string, any>(),
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn((key: string) => (key === 'xp' ? mockState.xpEnabled : false)),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    strategicFramework: {
      create: vi.fn(async ({ data }: any) => {
        const id = `fw-${mockState.frameworks.size + 1}`;
        const row = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        mockState.frameworks.set(id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return mockState.frameworks.get(where.id) || null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const fw = mockState.frameworks.get(where.id);
        if (!fw) throw new Error('Framework not found');
        Object.assign(fw, data, { updatedAt: new Date() });
        return fw;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, fw] of mockState.frameworks.entries()) {
          if (where.id && fw.id !== where.id) continue;
          if (where.packetId && fw.packetId !== where.packetId) continue;
          Object.assign(fw, data, { updatedAt: new Date() });
          count++;
        }
        return { count };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const fw = mockState.frameworks.get(where.id);
        mockState.frameworks.delete(where.id);
        return fw;
      }),
      findMany: vi.fn(async () => {
        return Array.from(mockState.frameworks.values());
      }),
    },
    boardPacket: {
      create: vi.fn(async ({ data }: any) => {
        const id = `packet-${mockState.packets.size + 1}`;
        const row = { id, status: 'upcoming', createdAt: new Date(), updatedAt: new Date(), items: [], ...data };
        mockState.packets.set(id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return mockState.packets.get(where.id) || null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const p = mockState.packets.get(where.id);
        if (!p) throw new Error('Packet not found');
        Object.assign(p, data, { updatedAt: new Date() });
        return p;
      }),
      findMany: vi.fn(async () => {
        return Array.from(mockState.packets.values());
      }),
    },
  },
}));

import {
  createStrategicFramework,
  updateStrategicFramework,
  deleteStrategicFramework,
  addFrameworkToBoardPacket,
  removeFrameworkFromBoardPacket,
  createBoardPacketWithFramework,
  listBoardPackets,
} from './xp';

describe('Strategic Frameworks & Board Packets Server Actions', () => {
  beforeEach(() => {
    mockState.frameworks.clear();
    mockState.packets.clear();
    mockState.session = {
      user: { id: 'user-xp', role: 'ADMIN', name: 'Executive Pastor', email: 'xp@example.org' },
    };
    mockState.xpEnabled = true;
  });

  it('creates a strategic framework with blank primitive data', async () => {
    const res = await createStrategicFramework({
      toolId: 'swot',
      title: '2026 Fall Sunday Worship SWOT',
      useTemplate: false,
    });

    expect(res.success).toBe(true);
    if (!res.success) return;

    const saved = mockState.frameworks.get(res.frameworkId);
    expect(saved).toBeDefined();
    expect(saved.toolId).toBe('swot');
    expect(saved.title).toBe('2026 Fall Sunday Worship SWOT');
    expect(saved.data).toEqual({ items: [] });
  });

  it('creates a strategic framework populated with church starter template', async () => {
    const res = await createStrategicFramework({
      toolId: 'swot',
      title: 'Church SWOT',
      useTemplate: true,
    });

    expect(res.success).toBe(true);
    if (!res.success) return;

    const saved = mockState.frameworks.get(res.frameworkId);
    expect(saved.data.items.length).toBeGreaterThan(0);
    expect(saved.data.items.some((i: any) => i.cellKey === 'strengths')).toBe(true);
  });

  it('updates title, status, and data on a strategic framework', async () => {
    const created = await createStrategicFramework({ toolId: 'soar', title: 'Initial SOAR' });
    if (!created.success) return;

    const updateRes = await updateStrategicFramework({
      id: created.frameworkId,
      title: 'Updated SOAR Matrix',
      status: 'in_review',
      data: { items: [{ id: '1', cellKey: 'aspirations', values: { text: 'Flourishing Community' } }] },
    });

    expect(updateRes.success).toBe(true);
    const updated = mockState.frameworks.get(created.frameworkId);
    expect(updated.title).toBe('Updated SOAR Matrix');
    expect(updated.status).toBe('in_review');
    expect(updated.data.items[0].values.text).toBe('Flourishing Community');
  });

  it('adds a framework to a board packet and updates packet items', async () => {
    const fwRes = await createStrategicFramework({ toolId: 'eisenhower', title: 'Weekly Triage' });
    if (!fwRes.success) return;

    // Create a packet
    const packetRes = await createBoardPacketWithFramework({
      packetTitle: 'Elder Meeting Packet - Sept 2026',
      meetingDate: '2026-09-14',
      frameworkId: fwRes.frameworkId,
      notes: 'Review prioritized items with Session',
    });

    expect(packetRes.success).toBe(true);
    if (!packetRes.success) return;

    const packet = mockState.packets.get(packetRes.packetId);
    expect(packet.items.length).toBe(1);
    expect(packet.items[0].frameworkId).toBe(fwRes.frameworkId);
    expect(packet.items[0].notes).toBe('Review prioritized items with Session');

    // Create another framework and add it to the existing packet
    const fw2Res = await createStrategicFramework({ toolId: 'darci', title: 'Worship DARCI' });
    if (!fw2Res.success) return;

    const addRes = await addFrameworkToBoardPacket({
      frameworkId: fw2Res.frameworkId,
      packetId: packetRes.packetId,
      notes: 'Key leadership designations',
    });

    expect(addRes.success).toBe(true);
    expect(packet.items.length).toBe(2);
    expect(packet.items[1].frameworkId).toBe(fw2Res.frameworkId);
  });

  it('removes a framework from a board packet', async () => {
    const fwRes = await createStrategicFramework({ toolId: 'tree', title: 'Staff Tree' });
    if (!fwRes.success) return;

    const packetRes = await createBoardPacketWithFramework({
      packetTitle: 'Staff Reorg Meeting',
      meetingDate: '2026-09-20',
      frameworkId: fwRes.frameworkId,
    });
    if (!packetRes.success) return;

    const removeRes = await removeFrameworkFromBoardPacket({
      packetId: packetRes.packetId,
      frameworkId: fwRes.frameworkId,
    });

    expect(removeRes.success).toBe(true);
    const packet = mockState.packets.get(packetRes.packetId);
    expect(packet.items.length).toBe(0);

    const fw = mockState.frameworks.get(fwRes.frameworkId);
    expect(fw.packetId).toBeNull();
  });

  it('deletes a strategic framework', async () => {
    const fwRes = await createStrategicFramework({ toolId: 'score', title: 'Software Score' });
    if (!fwRes.success) return;

    const delRes = await deleteStrategicFramework(fwRes.frameworkId);
    expect(delRes.success).toBe(true);
    expect(mockState.frameworks.has(fwRes.frameworkId)).toBe(false);
  });

  it('lists board packets with items count', async () => {
    const fwRes = await createStrategicFramework({ toolId: 'swot', title: 'SWOT' });
    if (!fwRes.success) return;

    await createBoardPacketWithFramework({
      packetTitle: 'Board Packet 1',
      meetingDate: '2026-09-14',
      frameworkId: fwRes.frameworkId,
    });

    const packets = await listBoardPackets();
    expect(packets.length).toBe(1);
    expect(packets[0].itemsCount).toBe(1);
  });
});
