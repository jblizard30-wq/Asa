'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import {
  PackageIcon,
  BuildingIcon,
  RoomIcon,
  ShoppingCartIcon,
  ClipboardListIcon,
  AlertTriangleIcon,
  SearchIcon,
  FilterIcon,
  PlusIcon,
  MinusIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  MapPinIcon,
  ChevronRightIcon,
  LayersIcon,
  QrCodeIcon,
  SparklesIcon,
  getTrackIcon,
} from '@/components/InventoryIcons';
import {
  submitStockCount,
  quickRestockItemToPar,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/lib/actions/inventory';
import { InventoryQuickScanner } from '@/components/InventoryQuickScanner';

export interface DashboardItem {
  id: string;
  name: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  neededQty: number;
  reorderThreshold: number;
  shelfLocation: string | null;
  sortOrder: number;
  notes: string | null;
  isSurged?: boolean;
  surgedParLevel?: number;
  surgeBadgeText?: string | null;
  surgeReason?: string | null;
  daysUntilFeast?: number | null;
  feastName?: string | null;
  roomId: string;
  room: {
    id: string;
    name: string;
    buildingId: string;
    building: {
      id: string;
      name: string;
    };
  };
  inventoryTypeId: string | null;
  inventoryType?: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  } | null;
  vendorId: string | null;
  vendor?: {
    id: string;
    name: string;
  } | null;
}

export interface DashboardBuilding {
  id: string;
  name: string;
  rooms: {
    id: string;
    name: string;
    itemCount: number;
    neededCount: number;
  }[];
}

export interface DashboardTrack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cadence: string;
  trackingMode: string;
  icon?: string | null;
  itemCount: number;
}

export interface DashboardVendorOption {
  id: string;
  name: string;
}

interface InventoryDashboardClientProps {
  canManage: boolean;
  buildings: DashboardBuilding[];
  tracks: DashboardTrack[];
  items: DashboardItem[];
  vendors: DashboardVendorOption[];
}

export function InventoryDashboardClient({
  canManage,
  buildings,
  tracks,
  items,
  vendors,
}: InventoryDashboardClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [onlyBelowPar, setOnlyBelowPar] = useState(false);

  // Quick inline count edit states
  const [countInputs, setCountInputs] = useState<Record<string, number>>({});
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickScannerOpen, setIsQuickScannerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('scanner') === 'open' || params.get('scan') === 'true') {
        setIsQuickScannerOpen(true);
      }
    }
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (onlyBelowPar && item.neededQty <= 0) return false;
      if (selectedTrack !== 'all' && item.inventoryTypeId !== selectedTrack) return false;
      if (selectedBuilding !== 'all' && item.room.buildingId !== selectedBuilding) return false;
      if (selectedRoom !== 'all' && item.roomId !== selectedRoom) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesLocation =
          item.room.name.toLowerCase().includes(q) ||
          item.room.building.name.toLowerCase().includes(q) ||
          (item.shelfLocation && item.shelfLocation.toLowerCase().includes(q));
        const matchesVendor = item.vendor?.name.toLowerCase().includes(q);
        if (!matchesName && !matchesLocation && !matchesVendor) return false;
      }

      return true;
    });
  }, [items, onlyBelowPar, selectedTrack, selectedBuilding, selectedRoom, searchQuery]);

  // Overall metrics
  const totalItemsCount = items.length;
  const itemsUnderParCount = items.filter((i) => i.neededQty > 0).length;
  const totalNeededUnits = items.reduce((sum, i) => sum + i.neededQty, 0);

  // Available rooms for building dropdown
  const availableRoomsForFilter = useMemo(() => {
    if (selectedBuilding === 'all') {
      return buildings.flatMap((b) => b.rooms.map((r) => ({ ...r, buildingName: b.name })));
    }
    const b = buildings.find((b) => b.id === selectedBuilding);
    return b ? b.rooms.map((r) => ({ ...r, buildingName: b.name })) : [];
  }, [buildings, selectedBuilding]);

  // Flat list of all rooms for item creation
  const allRooms = useMemo(() => {
    return buildings.flatMap((b) =>
      b.rooms.map((r) => ({
        id: r.id,
        name: `${b.name} — ${r.name}`,
        buildingId: b.id,
      }))
    );
  }, [buildings]);

  const handleInlineCountChange = (itemId: string, delta: number, current: number) => {
    const prev = countInputs[itemId] !== undefined ? countInputs[itemId] : current;
    const next = Math.max(0, prev + delta);
    setCountInputs((p) => ({ ...p, [itemId]: next }));
  };

  const handleQuickCountChange = (itemId: string, current: number, delta: number) => {
    handleInlineCountChange(itemId, delta, current);
  };

  const handleQuickCountDirect = (itemId: string, val: number) => {
    setCountInputs((p) => ({ ...p, [itemId]: Math.max(0, val) }));
  };

  const handleSaveCount = async (itemId: string, current: number) => {
    const qty = countInputs[itemId] !== undefined ? countInputs[itemId] : current;
    setSavingItemIds((prev) => new Set(prev).add(itemId));
    const res = await submitStockCount({ itemId, qty });
    setSavingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    if (res.success) {
      toast.success('Stock count recorded', `Updated to ${qty}`);
      router.refresh();
    } else {
      toast.error('Stock Count Failed', res.error);
    }
  };

  const handleRestockToPar = async (itemId: string) => {
    setSavingItemIds((prev) => new Set(prev).add(itemId));
    const res = await quickRestockItemToPar(itemId);
    setSavingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    if (res.success) {
      toast.success('Restocked to par level');
      router.refresh();
    } else {
      toast.error('Restock Failed', res.error);
    }
  };

  const handleDeleteItem = async (item: DashboardItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    const res = await deleteInventoryItem(item.id);
    if (!res.success) {
      toast.error('Delete Failed', res.error);
    } else {
      toast.success('Item removed from inventory');
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Inventory &amp; Count Hub
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Browse rooms to start mobile sheet-to-shelf counts, monitor par levels, and trigger restock orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsQuickScannerOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <QrCodeIcon className="h-4 w-4" />
            <span>Quick-Audit Scanner</span>
          </button>

          <Link
            href="/inventory/orders"
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            <span>Restock Orders</span>
            {itemsUnderParCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {itemsUnderParCount}
              </span>
            )}
          </Link>

          {canManage && (
            <button
              onClick={() => {
                setModalError(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total SKUs</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {totalItemsCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Items Below Par</div>
          <div
            className={`mt-1 text-2xl font-extrabold ${
              itemsUnderParCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
            }`}
          >
            {itemsUnderParCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Units Needed</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-600 dark:text-brand-400">
            {totalNeededUnits}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Buildings / Rooms</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {buildings.length} / {allRooms.length}
          </div>
        </div>
      </div>

      {/* Restock Warning Banner */}
      {itemsUnderParCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <AlertTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-amber-950 dark:text-amber-200">
                {itemsUnderParCount} item{itemsUnderParCount === 1 ? '' : 's'} currently below par level ({totalNeededUnits} total units)
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-400">
                Generate purchase orders grouped by vendor to restock, or quick-restock received supplies.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyBelowPar(!onlyBelowPar)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
            >
              {onlyBelowPar ? 'Show All Items' : 'Filter Below Par'}
            </button>
            <Link
              href="/inventory/orders"
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              View POs
            </Link>
          </div>
        </div>
      )}

      {/* Active Inventory Tracks */}
      {tracks.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Active Inventory Tracks
            </h2>
            <span className="text-xs text-slate-500">{tracks.length} Categories</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => {
              const isSelected = selectedTrack === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelectedTrack(isSelected ? 'all' : track.id)}
                  className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 dark:border-brand-500 dark:bg-brand-950/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getTrackIcon(track.slug || track.icon)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {track.name}
                      </h3>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {track.cadence}
                      </span>
                    </div>
                    {track.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{track.description}</p>
                    )}
                    <div className="mt-2 text-xs text-slate-400">
                      {track.itemCount} item{track.itemCount === 1 ? '' : 's'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Buildings & Rooms — Sheet to Shelf Mobile Counting */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Pick a Room to Count
            </h2>
            <p className="text-xs text-slate-500">
              Mobile sheet-to-shelf counting mode for room-by-room physical audits.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {buildings.length} Building{buildings.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {buildings.map((building) => (
            <div
              key={building.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BuildingIcon className="h-4 w-4 text-slate-400" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{building.name}</h3>
                </div>
                <span className="text-xs text-slate-500">{building.rooms.length} Rooms</span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {building.rooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/inventory/count/${room.id}`}
                    className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 transition-all hover:border-brand-400 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-brand-500 dark:hover:bg-slate-900"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{room.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span>{room.itemCount} items</span>
                        {room.neededCount > 0 && (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            &middot; {room.neededCount} below par
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform dark:text-brand-400">
                      <span>Count</span>
                      <ChevronRightIcon className="h-4 w-4" />
                    </div>
                  </Link>
                ))}

                {building.rooms.length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-slate-400">
                    No rooms added to this building yet.
                  </div>
                )}
              </div>
            </div>
          ))}

          {buildings.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
              No buildings or rooms configured yet.{' '}
              {canManage && (
                <Link href="/inventory/settings" className="font-semibold text-brand-600 hover:underline">
                  Configure buildings &amp; rooms in Settings
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Item Inventory Audit & Quick Count Table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Item Inventory &amp; Stock Levels
            </h2>
            <p className="text-xs text-slate-500">
              Browse, filter, and adjust on-hand inventory across all church facilities.
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Showing {filteredItems.length} of {items.length} items
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items, location, or vendor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Track Filter */}
          <div>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Tracks</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Building Filter */}
          <div>
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedRoom('all');
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Rooms</option>
              {availableRoomsForFilter.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Below Par Toggle */}
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={onlyBelowPar}
                onChange={(e) => setOnlyBelowPar(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
              />
              <span>Only show items below par level ({itemsUnderParCount})</span>
            </label>
          </div>
        </div>

        {/* Table of Items */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/30">
                <tr>
                  <th className="px-4 py-3">Item &amp; Track</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Par Level</th>
                  <th className="px-4 py-3 text-center">On Hand Count</th>
                  <th className="px-4 py-3 text-right">Restock Needed</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const currentInput =
                    countInputs[item.id] !== undefined ? countInputs[item.id] : item.onHandQty;
                  const hasDraftChange = countInputs[item.id] !== undefined && countInputs[item.id] !== item.onHandQty;
                  const isSaving = savingItemIds.has(item.id);
                  const isBelow = item.neededQty > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${
                        isBelow ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Name & Track */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                        {item.isSurged && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-900 border border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800">
                              <SparklesIcon className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                              <span>{item.surgeBadgeText || '⚡ Lent/Easter Par Surge Active'}</span>
                            </span>
                          </div>
                        )}
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                          {item.inventoryType && <span>{item.inventoryType.name}</span>}
                          {item.reorderThreshold > 0 && (
                            <span>&middot; Alert &le; {item.reorderThreshold} {item.unit}</span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>
                          {item.room.building.name} &rsaquo; {item.room.name}
                        </div>
                        {item.shelfLocation && (
                          <div className="mt-0.5 flex items-center gap-0.5 text-slate-400">
                            <MapPinIcon className="h-3 w-3" /> {item.shelfLocation}
                          </div>
                        )}
                      </td>

                      {/* Par */}
                      <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">
                        {item.isSurged && item.surgedParLevel ? (
                          <div>
                            <strong className="text-purple-700 dark:text-purple-400 font-bold">{item.surgedParLevel}</strong> {item.unit}
                            <span className="block text-[10px] text-slate-400 font-medium">
                              (Base: {item.idealQty} &middot; +50%)
                            </span>
                          </div>
                        ) : (
                          <div>
                            <strong>{item.idealQty}</strong> {item.unit}
                          </div>
                        )}
                      </td>

                      {/* On Hand Stepper */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickCountChange(item.id, item.onHandQty, -1)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Decrease count"
                          >
                            <MinusIcon className="h-3.5 w-3.5" />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={currentInput}
                            onChange={(e) => handleQuickCountDirect(item.id, parseInt(e.target.value) || 0)}
                            className={`w-14 rounded border px-1.5 py-1 text-center text-xs font-bold ${
                              hasDraftChange
                                ? 'border-brand-500 bg-brand-50/50 text-brand-900 dark:bg-brand-950/40 dark:text-brand-200'
                                : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleQuickCountChange(item.id, item.onHandQty, 1)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Increase count"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>

                          {hasDraftChange && (
                            <button
                              type="button"
                              onClick={() => handleSaveCount(item.id, item.onHandQty)}
                              disabled={isSaving}
                              className="rounded bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-50"
                            >
                              {isSaving ? '…' : 'Save'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Needed */}
                      <td className="px-4 py-3 text-right">
                        {item.neededQty > 0 ? (
                          <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            +{item.neededQty} {item.unit}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckIcon className="h-3 w-3" /> Stocked
                          </span>
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.vendor?.name ? (
                          <span>{item.vendor.name}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          {item.neededQty > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRestockToPar(item.id)}
                              disabled={isSaving}
                              title="Set on-hand count to par level"
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                            >
                              Restock to Par
                            </button>
                          )}

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalError(null);
                                  setEditingItem(item);
                                }}
                                className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="Edit item"
                              >
                                <EditIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="rounded p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Delete item"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              No items match your filter criteria.{' '}
              {onlyBelowPar && (
                <button
                  type="button"
                  onClick={() => setOnlyBelowPar(false)}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Clear &apos;below par&apos; filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE ITEM MODAL */}
      {isCreateModalOpen && (
        <ItemFormModal
          title="Add New Inventory Item"
          rooms={allRooms}
          tracks={tracks}
          vendors={vendors}
          error={modalError}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={async (data) => {
            setModalError(null);
            const res = await createInventoryItem(data);
            if (!res.success) {
              setModalError(res.error);
              return;
            }
            setIsCreateModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
        <ItemFormModal
          title={`Edit "${editingItem.name}"`}
          initialData={{
            name: editingItem.name,
            unit: editingItem.unit,
            idealQty: editingItem.idealQty,
            onHandQty: editingItem.onHandQty,
            reorderThreshold: editingItem.reorderThreshold,
            shelfLocation: editingItem.shelfLocation || '',
            sortOrder: editingItem.sortOrder,
            roomId: editingItem.roomId,
            inventoryTypeId: editingItem.inventoryTypeId || '',
            vendorId: editingItem.vendorId || '',
            notes: editingItem.notes || '',
          }}
          rooms={allRooms}
          tracks={tracks}
          vendors={vendors}
          error={modalError}
          onClose={() => setEditingItem(null)}
          onSubmit={async (data) => {
            setModalError(null);
            const res = await updateInventoryItem(editingItem.id, data);
            if (!res.success) {
              setModalError(res.error);
              return;
            }
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}

      {/* MOBILE FLOATING QUICK-AUDIT BUTTON */}
      <button
        type="button"
        onClick={() => setIsQuickScannerOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700 active:scale-95 transition"
        title="Quick-Audit Scanner"
        aria-label="Open Quick-Audit Scanner"
      >
        <QrCodeIcon className="h-6 w-6" />
      </button>

      {/* QUICK SCANNER MODAL */}
      <InventoryQuickScanner
        isOpen={isQuickScannerOpen}
        onClose={() => setIsQuickScannerOpen(false)}
        items={items}
        onCountSaved={(itemId, newQty) => {
          setCountInputs((p) => ({ ...p, [itemId]: newQty }));
          router.refresh();
        }}
      />
    </div>
  );
}

interface ItemFormData {
  name: string;
  unit: string;
  idealQty: number;
  onHandQty?: number;
  reorderThreshold: number;
  shelfLocation?: string;
  sortOrder: number;
  roomId: string;
  inventoryTypeId?: string;
  vendorId?: string;
  notes?: string;
}

function ItemFormModal({
  title,
  initialData,
  rooms,
  tracks,
  vendors,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  initialData?: Partial<ItemFormData>;
  rooms: { id: string; name: string }[];
  tracks: DashboardTrack[];
  vendors: DashboardVendorOption[];
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ItemFormData) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  // updateInventoryItem accepts no onHandQty, so an edited value here was silently
  // dropped. Only createInventoryItem takes an opening quantity.
  const isEdit = initialData !== undefined;
  const [name, setName] = useState(initialData?.name || '');
  const [unit, setUnit] = useState(initialData?.unit || 'Boxes');
  const [idealQty, setIdealQty] = useState(initialData?.idealQty ?? 10);
  const [onHandQty, setOnHandQty] = useState(initialData?.onHandQty ?? 0);
  const [reorderThreshold, setReorderThreshold] = useState(initialData?.reorderThreshold ?? 2);
  const [shelfLocation, setShelfLocation] = useState(initialData?.shelfLocation || '');
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const [roomId, setRoomId] = useState(initialData?.roomId || (rooms[0]?.id ?? ''));
  const [inventoryTypeId, setInventoryTypeId] = useState(initialData?.inventoryTypeId || '');
  const [vendorId, setVendorId] = useState(initialData?.vendorId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      name,
      unit,
      idealQty: Number(idealQty),
      onHandQty: Number(onHandQty),
      reorderThreshold: Number(reorderThreshold),
      shelfLocation: shelfLocation.trim() || undefined,
      sortOrder: Number(sortOrder),
      roomId,
      inventoryTypeId: inventoryTypeId || undefined,
      vendorId: vendorId || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 8oz Coffee Cups, 1/2 Fold Paper Towels"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Unit of Measure *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Boxes, Packs, Rolls"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Par Level (Target Ideal) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={idealQty}
                onChange={(e) => setIdealQty(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isEdit ? 'Current On Hand Qty (count to change)' : 'Current On Hand Qty'}
              </label>
              <input
                type="number"
                min="0"
                value={onHandQty}
                disabled={isEdit}
                onChange={(e) => setOnHandQty(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-400"
              />
              {isEdit && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  On hand changes through a stock count, so it stays attributable — use the
                  count controls on the item row.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Reorder Threshold (Alert below)
              </label>
              <input
                type="number"
                min="0"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Room / Storage Location *
              </label>
              <select
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Shelf / Bin Location
              </label>
              <input
                type="text"
                placeholder="e.g. Aisle 2, Top Shelf"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Inventory Category
              </label>
              <select
                value={inventoryTypeId}
                onChange={(e) => setInventoryTypeId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">General / Uncategorized</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preferred Supplier
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">No vendor assigned</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Order in pairs, vendor SKU #1048"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
