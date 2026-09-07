'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import {
  BuildingIcon,
  RoomIcon,
  LayersIcon,
  PackageIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  MapPinIcon,
  getTrackIcon,
} from '@/components/InventoryIcons';
import {
  createBuilding,
  updateBuilding,
  deleteBuilding,
  createRoom,
  updateRoom,
  deleteRoom,
  createInventoryType,
  deleteInventoryType,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/lib/actions/inventory';

export interface SettingsBuilding {
  id: string;
  name: string;
  rooms: {
    id: string;
    name: string;
    itemCount: number;
  }[];
}

export interface SettingsTrack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cadence: string;
  trackingMode: string;
  icon: string | null;
  itemCount: number;
}

export interface SettingsItem {
  id: string;
  name: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  reorderThreshold: number;
  shelfLocation: string | null;
  sortOrder: number;
  notes: string | null;
  roomId: string;
  roomName: string;
  buildingId: string;
  buildingName: string;
  inventoryTypeId: string | null;
  categoryName: string | null;
  vendorId: string | null;
  vendorName: string | null;
}

export interface VendorOption {
  id: string;
  name: string;
}

interface InventorySettingsClientProps {
  buildings: SettingsBuilding[];
  tracks: SettingsTrack[];
  items: SettingsItem[];
  vendors: VendorOption[];
}

export function InventorySettingsClient({
  buildings,
  tracks,
  items,
  vendors,
}: InventorySettingsClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'locations' | 'tracks' | 'catalog'>('locations');

  // Locations state
  const [newBuildingName, setNewBuildingName] = useState('');
  const [addingRoomBuildingId, setAddingRoomBuildingId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [renamingBuildingId, setRenamingBuildingId] = useState<string | null>(null);
  const [renameBuildingValue, setRenameBuildingValue] = useState('');

  // Tracks state
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [trackSlug, setTrackSlug] = useState('');
  const [trackDescription, setTrackDescription] = useState('');
  const [trackCadence, setTrackCadence] = useState('weekly');
  const [trackIcon, setTrackIcon] = useState('Package');

  // Catalog item edit state
  const [editingItem, setEditingItem] = useState<SettingsItem | null>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Flat rooms for catalog
  const flatRooms = useMemo(() => {
    return buildings.flatMap((b) =>
      b.rooms.map((r) => ({
        id: r.id,
        name: `${b.name} — ${r.name}`,
        buildingId: b.id,
      }))
    );
  }, [buildings]);

  const filteredCatalogItems = useMemo(() => {
    if (!catalogSearch.trim()) return items;
    const q = catalogSearch.toLowerCase();
    return items.filter((i) => {
      return (
        i.name.toLowerCase().includes(q) ||
        i.roomName.toLowerCase().includes(q) ||
        i.buildingName.toLowerCase().includes(q) ||
        (i.categoryName && i.categoryName.toLowerCase().includes(q)) ||
        (i.vendorName && i.vendorName.toLowerCase().includes(q))
      );
    });
  }, [items, catalogSearch]);

  // Actions for buildings and rooms
  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim()) return;
    const res = await createBuilding({ name: newBuildingName.trim() });
    if (!res.success) {
      toast.error('Building Creation Failed', res.error);
    } else {
      toast.success(`Created building "${newBuildingName.trim()}"`);
      setNewBuildingName('');
      router.refresh();
    }
  };

  const handleRenameBuilding = async (id: string) => {
    if (!renameBuildingValue.trim()) {
      setRenamingBuildingId(null);
      return;
    }
    const res = await updateBuilding(id, { name: renameBuildingValue.trim() });
    if (!res.success) {
      toast.error('Rename Failed', res.error);
    } else {
      toast.success('Building renamed');
      setRenamingBuildingId(null);
      router.refresh();
    }
  };

  const handleDeleteBuilding = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete building "${name}" and all its rooms and items? This action cannot be undone.`
      )
    ) {
      return;
    }
    const res = await deleteBuilding(id);
    if (!res.success) {
      toast.error('Delete Failed', res.error);
    } else {
      toast.success(`Deleted building "${name}"`);
      router.refresh();
    }
  };

  const handleCreateRoom = async (buildingId: string) => {
    if (!newRoomName.trim()) return;
    const res = await createRoom({ buildingId, name: newRoomName.trim() });
    if (!res.success) {
      toast.error('Room Creation Failed', res.error);
    } else {
      toast.success(`Created room "${newRoomName.trim()}"`);
      setNewRoomName('');
      setAddingRoomBuildingId(null);
      router.refresh();
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (!confirm(`Delete room "${name}" and all its items? This action cannot be undone.`)) return;
    const res = await deleteRoom(id);
    if (!res.success) {
      toast.error('Delete Failed', res.error);
    } else {
      toast.success(`Deleted room "${name}"`);
      router.refresh();
    }
  };

  // Track actions
  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackName.trim()) return;
    setModalError(null);
    const res = await createInventoryType({
      name: trackName.trim(),
      slug: trackSlug.trim() || undefined,
      description: trackDescription.trim() || undefined,
      cadence: trackCadence,
      icon: trackIcon,
    });
    if (!res.success) {
      setModalError(res.error);
      toast.error('Track Creation Failed', res.error);
    } else {
      toast.success(`Created category track "${trackName.trim()}"`);
      setIsTrackModalOpen(false);
      setTrackName('');
      setTrackSlug('');
      setTrackDescription('');
      router.refresh();
    }
  };

  const handleDeleteTrack = async (id: string, name: string) => {
    if (!confirm(`Delete category track "${name}"? Items will become uncategorized.`)) return;
    const res = await deleteInventoryType(id);
    if (!res.success) {
      toast.error('Delete Failed', res.error);
    } else {
      toast.success(`Deleted track "${name}"`);
      router.refresh();
    }
  };

  // Catalog item delete
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete item "${name}" from the catalog?`)) return;
    const res = await deleteInventoryItem(id);
    if (!res.success) {
      toast.error('Delete Failed', res.error);
    } else {
      toast.success(`Deleted item "${name}"`);
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Inventory Catalog &amp; Facility Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure facility structures (buildings and rooms), replicable inventory domains, and item catalog entries.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-sm font-medium dark:border-slate-800">
        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'locations'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <BuildingIcon className="h-4 w-4" /> Buildings &amp; Rooms ({buildings.length})
        </button>
        <button
          onClick={() => setActiveTab('tracks')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'tracks'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <LayersIcon className="h-4 w-4" /> Inventory Tracks ({tracks.length})
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'catalog'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <PackageIcon className="h-4 w-4" /> Master Item Catalog ({items.length})
        </button>
      </div>

      {/* TAB 1: BUILDINGS & ROOMS */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Add Building Form */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Add New Building</h2>
            <form onSubmit={handleCreateBuilding} className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Building name (e.g. Sanctuary & Narthex, Education Wing)"
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                className="min-w-[280px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <PlusIcon className="h-4 w-4" /> Add Building
              </button>
            </form>
          </div>

          {/* Buildings List with Nested Rooms */}
          <div className="space-y-4">
            {buildings.map((building) => (
              <div
                key={building.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Building Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-5 w-5 text-slate-500" />
                    {renamingBuildingId === building.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={renameBuildingValue}
                          onChange={(e) => setRenameBuildingValue(e.target.value)}
                          className="rounded border border-brand-500 px-2 py-0.5 text-sm font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameBuilding(building.id)}
                          className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingBuildingId(null)}
                          className="text-xs text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        {building.name}
                      </h3>
                    )}
                    <span className="text-xs text-slate-400">
                      ({building.rooms.length} room{building.rooms.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingBuildingId(building.id);
                        setRenameBuildingValue(building.name);
                      }}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBuilding(building.id, building.name)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Rooms list */}
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {building.rooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/30"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {room.name}
                          </span>
                          <span className="ml-1 text-slate-400">({room.itemCount} items)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room.id, room.name)}
                          className="text-slate-400 hover:text-red-600"
                          title="Delete room"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add Room inline card */}
                    {addingRoomBuildingId === building.id ? (
                      <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50/50 p-2 dark:border-brand-700 dark:bg-brand-950/30">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Room name…"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateRoom(building.id);
                            if (e.key === 'Escape') setAddingRoomBuildingId(null);
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateRoom(building.id)}
                          className="rounded bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingRoomBuildingId(null)}
                          className="text-xs text-slate-500"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingRoomBuildingId(building.id);
                          setNewRoomName('');
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:text-slate-300"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Add Room to {building.name}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {buildings.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
                No buildings configured. Add your first building above to start organizing rooms.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY TRACKS */}
      {activeTab === 'tracks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Configured Inventory Domains
              </h2>
              <p className="text-xs text-slate-500">
                Replicable multi-inventory categories with cadences and tracking modes.
              </p>
            </div>
            <button
              onClick={() => {
                setModalError(null);
                setIsTrackModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusIcon className="h-4 w-4" /> Add Inventory Track
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      {getTrackIcon(track.slug || track.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{track.name}</h3>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {track.cadence}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">{track.slug}</div>
                    </div>
                  </div>

                  {track.description && (
                    <p className="mt-3 text-xs text-slate-500">{track.description}</p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-400">{track.itemCount} items assigned</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrack(track.id, track.name)}
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Track Modal */}
          {isTrackModalOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
              onClick={() => setIsTrackModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Add Inventory Track
                </h2>
                <form onSubmit={handleCreateTrack} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Track Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Weekly Consumables, Liturgical Supplies"
                      value={trackName}
                      onChange={(e) => {
                        setTrackName(e.target.value);
                        if (!trackSlug) {
                          setTrackSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Slug Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="weekly-consumables"
                      value={trackSlug}
                      onChange={(e) => setTrackSlug(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Audit Cadence
                      </label>
                      <select
                        value={trackCadence}
                        onChange={(e) => setTrackCadence(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Icon
                      </label>
                      <select
                        value={trackIcon}
                        onChange={(e) => setTrackIcon(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="Package">Package</option>
                        <option value="Coffee">Coffee / Consumables</option>
                        <option value="Sparkles">Sparkles / Worship</option>
                        <option value="Printer">Printer / Office</option>
                        <option value="Baby">Baby / Nursery</option>
                        <option value="ShieldCheck">Shield / Janitorial</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Domain description and scope…"
                      value={trackDescription}
                      onChange={(e) => setTrackDescription(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {modalError && <p className="text-xs text-red-600">{modalError}</p>}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsTrackModalOpen(false)}
                      className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Create Track
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MASTER ITEM CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Master Items Catalog
              </h2>
              <p className="text-xs text-slate-500">
                Full list of all configured items with room assignments, par levels, and vendors.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search catalog…"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />

              <button
                onClick={() => {
                  setModalError(null);
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <PlusIcon className="h-4 w-4" /> Add Item
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/30">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Track</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Par Level</th>
                    <th className="px-4 py-3 text-right">Reorder Threshold</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalogItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {item.categoryName || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.buildingName} &rsaquo; {item.roomName}
                        {item.shelfLocation && (
                          <div className="text-[11px] text-slate-400">📍 {item.shelfLocation}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <strong>{item.idealQty}</strong> {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {item.reorderThreshold} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.vendorName || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setModalError(null);
                              setEditingItem(item);
                            }}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <EditIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredCatalogItems.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                No items found matching search.
              </div>
            )}
          </div>

          {/* Add Item Modal */}
          {isAddItemModalOpen && (
            <CatalogItemModal
              title="Add New Catalog Item"
              rooms={flatRooms}
              tracks={tracks}
              vendors={vendors}
              error={modalError}
              onClose={() => setIsAddItemModalOpen(false)}
              onSubmit={async (data) => {
                setModalError(null);
                const res = await createInventoryItem(data);
                if (!res.success) {
                  setModalError(res.error);
                  return;
                }
                setIsAddItemModalOpen(false);
                router.refresh();
              }}
            />
          )}

          {/* Edit Item Modal */}
          {editingItem && (
            <CatalogItemModal
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
              rooms={flatRooms}
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
        </div>
      )}
    </div>
  );
}

function CatalogItemModal({
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
  initialData?: {
    name: string;
    unit: string;
    idealQty: number;
    onHandQty: number;
    reorderThreshold: number;
    shelfLocation?: string;
    sortOrder: number;
    roomId: string;
    inventoryTypeId?: string;
    vendorId?: string;
    notes?: string;
  };
  rooms: { id: string; name: string }[];
  tracks: SettingsTrack[];
  vendors: VendorOption[];
  error: string | null;
  onClose: () => void;
  onSubmit: (data: {
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
  }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
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
      name: name.trim(),
      unit: unit.trim(),
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Unit of Measure *</label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Par Level (Target Ideal) *</label>
              <input
                type="number"
                min="0"
                required
                value={idealQty}
                onChange={(e) => setIdealQty(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Current On Hand</label>
              <input
                type="number"
                min="0"
                value={onHandQty}
                onChange={(e) => setOnHandQty(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Reorder Threshold</label>
              <input
                type="number"
                min="0"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Room Location *</label>
              <select
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Shelf Location</label>
              <input
                type="text"
                placeholder="e.g. Shelf B, Top Bin"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Inventory Track</label>
              <select
                value={inventoryTypeId}
                onChange={(e) => setInventoryTypeId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Supplier</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
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
