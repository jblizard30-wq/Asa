'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCartIcon,
  PlusIcon,
  MailIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PackageIcon,
  BuildingIcon,
  ExternalLinkIcon,
} from '@/components/InventoryIcons';
import {
  createRestockOrder,
  quickRestockVendorItemsToPar,
} from '@/lib/actions/inventory';
import { formatCalendarDate, getChicagoToday } from '@/lib/dateUtils';

/** Synthetic grouping key used by the orders page for items with no vendor. */
const UNASSIGNED_VENDOR_ID = 'unassigned';

export interface VendorNeededGroup {
  vendorId: string;
  vendorName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  url: string | null;
  items: {
    id: string;
    name: string;
    unit: string;
    idealQty: number;
    onHandQty: number;
    neededQty: number;
    shelfLocation: string | null;
    roomName: string;
    buildingName: string;
  }[];
}

export interface RestockOrderSummary {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  totalCost: number | null;
  itemCount: number;
  orderedByName: string | null;
  createdAt: string;
}

export interface VendorOption {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    unit: string;
    idealQty: number;
    onHandQty: number;
    neededQty: number;
  }[];
}

interface RestockOrdersListClientProps {
  canManage: boolean;
  orders: RestockOrderSummary[];
  vendorNeededGroups: VendorNeededGroup[];
  allVendors: VendorOption[];
}

export function RestockOrdersListClient({
  canManage,
  orders,
  vendorNeededGroups,
  allVendors,
}: RestockOrdersListClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [expandedVendorIds, setExpandedVendorIds] = useState<Set<string>>(
    () => new Set(vendorNeededGroups.map((g) => g.vendorId))
  );

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const totalNeededSKUs = vendorNeededGroups.reduce((sum, g) => sum + g.items.length, 0);
  const totalDraftOrders = orders.filter((o) => o.status === 'draft').length;
  const totalActiveOrders = orders.filter((o) => o.status === 'ordered' || o.status === 'shipped').length;
  const totalReceivedOrders = orders.filter((o) => o.status === 'received').length;

  const toggleVendorExpand = (vendorId: string) => {
    setExpandedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const handleQuickRestockVendor = async (vendorId: string, vendorName: string) => {
    if (!confirm(`Mark all items from "${vendorName}" as restocked to par level?`)) return;
    // 'unassigned' is a synthetic grouping key for items with no vendor (see the orders
    // page), not a real Vendor id. Passing it through matched nothing and reported success.
    const res = await quickRestockVendorItemsToPar(
      vendorId === UNASSIGNED_VENDOR_ID ? null : vendorId
    );
    if (!res.success) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleCreateDraftFromGroup = async (group: VendorNeededGroup) => {
    // A purchase order requires a real vendor (RestockOrder.vendorId is a non-null FK), so
    // the synthetic "Unassigned Supplier" group cannot become one — sending the sentinel
    // through produced a raw foreign-key error in an alert box.
    if (group.vendorId === UNASSIGNED_VENDOR_ID) {
      alert(
        'These items have no vendor assigned. Assign a vendor to them first, then create a purchase order.'
      );
      return;
    }
    const res = await createRestockOrder({
      vendorId: group.vendorId,
      items: group.items.map((i) => ({
        itemId: i.id,
        quantityOrdered: i.neededQty,
      })),
    });
    if (!res.success) {
      alert(res.error);
    } else {
      router.push(`/inventory/orders/${res.orderId}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        );
      case 'ordered':
        return (
          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            Ordered
          </span>
        );
      case 'shipped':
        return (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Shipped
          </span>
        );
      case 'received':
        return (
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Received
          </span>
        );
      case 'canceled':
        return (
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold uppercase text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            Canceled
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ShoppingCartIcon className="h-4 w-4 text-brand-600" />
            Purchasing &amp; Restock Hub
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Restock &amp; Purchase Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Auto-calculated restock requirements grouped by supplier, 1-click email POs, and purchase order tracking.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setModalError(null);
              setIsNewOrderModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <PlusIcon className="h-4 w-4" /> Create Purchase Order
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Items Needing Restock</div>
          <div
            className={`mt-1 text-2xl font-extrabold ${
              totalNeededSKUs > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
            }`}
          >
            {totalNeededSKUs}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Draft Orders</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {totalDraftOrders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Active (Ordered/Shipped)</div>
          <div className="mt-1 text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {totalActiveOrders}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed (Received)</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {totalReceivedOrders}
          </div>
        </div>
      </div>

      {/* SECTION 1: SUPPLIERS NEEDING RESTOCK (Source App Vendor PO Cards) */}
      {vendorNeededGroups.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Items Below Par by Supplier ({vendorNeededGroups.length})
            </h2>
            <p className="text-xs text-slate-500">
              Immediate replenishment needs calculated from on-hand stock and par levels.
            </p>
          </div>

          <div className="space-y-4">
            {vendorNeededGroups.map((group) => {
              const isExpanded = expandedVendorIds.has(group.vendorId);
              const totalUnits = group.items.reduce((sum, i) => sum + i.neededQty, 0);

              const emailBody =
                `Hi ${group.contactPerson || group.vendorName},\n\nPlease place an order for church supplies:\n\n` +
                group.items
                  .map(
                    (i) =>
                      `• ${i.name} — ${i.neededQty} ${i.unit} (Destination: ${i.buildingName} / ${i.roomName}${
                        i.shelfLocation ? `, Shelf: ${i.shelfLocation}` : ''
                      })`
                  )
                  .join('\n') +
                `\n\nThank you,\nChesterfield Presbyterian Church Facilities & Operations`;

              const mailtoUrl = `mailto:${group.email || ''}?subject=${encodeURIComponent(
                `Supply Restock Order — ${group.vendorName}`
              )}&body=${encodeURIComponent(emailBody)}`;

              return (
                <div
                  key={group.vendorId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                        <BuildingIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {group.vendorName}
                          </h3>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {group.items.length} items ({totalUnits} units)
                          </span>
                        </div>
                        {group.contactPerson && (
                          <p className="text-xs text-slate-500">
                            Rep: {group.contactPerson}
                            {group.email && ` · ${group.email}`}
                            {group.phone && ` · ${group.phone}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {group.email && (
                        <a
                          href={mailtoUrl}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700"
                        >
                          <MailIcon className="h-3.5 w-3.5" /> 1-Click Email PO
                        </a>
                      )}

                      {group.url && (
                        <a
                          href={group.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" /> Portal
                        </a>
                      )}

                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCreateDraftFromGroup(group)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <ShoppingCartIcon className="h-3.5 w-3.5 text-slate-400" /> Create PO
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickRestockVendor(group.vendorId, group.vendorName)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700"
                          >
                            <CheckCheckIcon className="h-3.5 w-3.5" /> Restock to Par
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleVendorExpand(group.vendorId)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-950/20">
                          <tr>
                            <th className="px-5 py-2.5">Item</th>
                            <th className="px-5 py-2.5">Destination</th>
                            <th className="px-5 py-2.5 text-right">On Hand</th>
                            <th className="px-5 py-2.5 text-right">Par Level</th>
                            <th className="px-5 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                              To Order
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {group.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                {item.name}
                              </td>
                              <td className="px-5 py-2.5 text-xs text-slate-500">
                                {item.buildingName} &rsaquo; {item.roomName}
                                {item.shelfLocation && ` (${item.shelfLocation})`}
                              </td>
                              <td className="px-5 py-2.5 text-right text-xs text-slate-500">
                                {item.onHandQty} {item.unit}
                              </td>
                              <td className="px-5 py-2.5 text-right text-xs text-slate-500">
                                {item.idealQty} {item.unit}
                              </td>
                              <td className="px-5 py-2.5 text-right">
                                <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  +{item.neededQty} {item.unit}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: PURCHASE ORDERS TABLE */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Purchase Orders Directory
            </h2>
            <p className="text-xs text-slate-500">
              Track orders through draft, ordered, shipped, received, and canceled statuses.
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
            {['all', 'draft', 'ordered', 'shipped', 'received', 'canceled'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/30">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3">Ordered By</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <Link
                        href={`/inventory/orders/${order.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {order.poNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {order.vendorName}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatCalendarDate(order.orderDate) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                      {order.totalCost !== null ? `$${order.totalCost.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {order.orderedByName || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/orders/${order.id}`}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Details &rsaquo;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="p-12 text-center text-sm text-slate-400">
              No purchase orders found matching this filter.
            </div>
          )}
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {isNewOrderModalOpen && (
        <CreateOrderModal
          vendors={allVendors}
          error={modalError}
          onClose={() => setIsNewOrderModalOpen(false)}
          onSubmit={async (data) => {
            setModalError(null);
            const res = await createRestockOrder(data);
            if (!res.success) {
              setModalError(res.error);
              return;
            }
            setIsNewOrderModalOpen(false);
            router.push(`/inventory/orders/${res.orderId}`);
          }}
        />
      )}
    </div>
  );
}

function CreateOrderModal({
  vendors,
  error,
  onClose,
  onSubmit,
}: {
  vendors: VendorOption[];
  error: string | null;
  onClose: () => void;
  onSubmit: (data: {
    vendorId: string;
    orderDate?: string;
    expectedDelivery?: string;
    notes?: string;
    items: Array<{ itemId: string; quantityOrdered: number }>;
  }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [orderDate, setOrderDate] = useState(getChicagoToday());
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');

  // Selected vendor items
  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.id === vendorId);
  }, [vendors, vendorId]);

  // Pre-selected items (default to all items needing restock for this vendor)
  const [selectedItemMap, setSelectedItemMap] = useState<Record<string, number>>({});

  // When vendor changes, pre-populate needed items
  const handleVendorChange = (id: string) => {
    setVendorId(id);
    const v = vendors.find((item) => item.id === id);
    if (v) {
      const initial: Record<string, number> = {};
      v.items.forEach((i) => {
        if (i.neededQty > 0) {
          initial[i.id] = i.neededQty;
        }
      });
      setSelectedItemMap(initial);
    } else {
      setSelectedItemMap({});
    }
  };

  const handleToggleItem = (itemId: string, defaultQty: number) => {
    setSelectedItemMap((prev) => {
      const next = { ...prev };
      if (next[itemId] !== undefined) {
        delete next[itemId];
      } else {
        next[itemId] = Math.max(1, defaultQty);
      }
      return next;
    });
  };

  const handleQtyChange = (itemId: string, qty: number) => {
    setSelectedItemMap((prev) => ({
      ...prev,
      [itemId]: Math.max(1, qty),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    setLoading(true);
    const items = Object.entries(selectedItemMap).map(([itemId, quantityOrdered]) => ({
      itemId,
      quantityOrdered,
    }));

    await onSubmit({
      vendorId,
      orderDate: orderDate || undefined,
      expectedDelivery: expectedDelivery || undefined,
      notes: notes.trim() || undefined,
      items,
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Create Purchase Order
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Supplier / Vendor *
            </label>
            <select
              required
              value={vendorId}
              onChange={(e) => handleVendorChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.items.filter((i) => i.neededQty > 0).length} needed)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Expected Delivery
              </label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Items selection */}
          {selectedVendor && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Line Items for this Order
              </label>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
                {selectedVendor.items.map((item) => {
                  const isChecked = selectedItemMap[item.id] !== undefined;
                  const qty = selectedItemMap[item.id] || (item.neededQty > 0 ? item.neededQty : 1);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-md p-2 transition-colors ${
                        isChecked
                          ? 'bg-brand-50/60 dark:bg-brand-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.id, item.neededQty > 0 ? item.neededQty : 1)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {item.name}
                        </span>
                        <span className="text-slate-400">
                          ({item.onHandQty}/{item.idealQty} {item.unit})
                        </span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-center text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                          />
                          <span className="text-slate-500">{item.unit}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {selectedVendor.items.length === 0 && (
                  <p className="py-4 text-center text-slate-400">
                    No items currently assigned to this vendor. You can add items after creating the PO.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Delivery instructions, quote reference, PO instructions…"
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
              {loading ? 'Creating…' : 'Create Draft PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
