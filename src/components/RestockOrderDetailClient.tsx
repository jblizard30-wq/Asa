'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  MailIcon,
  DownloadIcon,
  BuildingIcon,
  PhoneIcon,
  ExternalLinkIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  CheckCheckIcon,
  MapPinIcon,
} from '@/components/InventoryIcons';
import {
  updateRestockOrderStatus,
  updateRestockOrder,
  addRestockOrderItem,
  updateRestockOrderItem,
  deleteRestockOrderItem,
  receiveRestockOrder,
  deleteRestockOrder,
} from '@/lib/actions/inventory';
import { formatCalendarDate } from '@/lib/dateUtils';

export interface OrderDetailItem {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number | null;
  roomName: string;
  buildingName: string;
  shelfLocation: string | null;
  categoryName: string | null;
}

export interface OrderDetailData {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  totalCost: number | null;
  notes: string | null;
  vendor: {
    id: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    url: string | null;
    notes: string | null;
  };
  orderedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: string;
  items: OrderDetailItem[];
}

export interface AvailableItemOption {
  id: string;
  name: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  neededQty: number;
}

interface RestockOrderDetailClientProps {
  canManage: boolean;
  order: OrderDetailData;
  availableVendorItems: AvailableItemOption[];
}

export function RestockOrderDetailClient({
  canManage,
  order,
  availableVendorItems,
}: RestockOrderDetailClientProps) {
  const router = useRouter();
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderDetailItem | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(order.notes || '');
  const [orderDateValue, setOrderDateValue] = useState(
    order.orderDate ? order.orderDate.split('T')[0] : ''
  );
  const [deliveryDateValue, setDeliveryDateValue] = useState(
    order.expectedDelivery ? order.expectedDelivery.split('T')[0] : ''
  );
  const [statusLoading, setStatusLoading] = useState(false);

  // Status progression badge
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        );
      case 'ordered':
        return (
          <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold uppercase text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            Ordered
          </span>
        );
      case 'shipped':
        return (
          <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Shipped
          </span>
        );
      case 'received':
        return (
          <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Received
          </span>
        );
      case 'canceled':
        return (
          <span className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            Canceled
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
            {status}
          </span>
        );
    }
  };

  const handleStatusChange = async (newStatus: 'draft' | 'ordered' | 'shipped' | 'received' | 'canceled') => {
    if (newStatus === 'received') {
      const updateStock = confirm(
        'Mark order as received?\n\nClick OK to also update on-hand stock counts in inventory for all received items, or Cancel to update order status only.'
      );
      setStatusLoading(true);
      await receiveRestockOrder(order.id, updateStock);
      setStatusLoading(false);
      router.refresh();
      return;
    }

    setStatusLoading(true);
    await updateRestockOrderStatus(order.id, newStatus);
    setStatusLoading(false);
    router.refresh();
  };

  const handleSaveDatesAndNotes = async () => {
    await updateRestockOrder(order.id, {
      orderDate: orderDateValue || null,
      expectedDelivery: deliveryDateValue || null,
      notes: notesValue.trim() || null,
    });
    setIsEditingNotes(false);
    router.refresh();
  };

  const handleDeleteOrder = async () => {
    if (!confirm(`Are you sure you want to permanently delete purchase order "${order.poNumber}"?`)) {
      return;
    }
    const res = await deleteRestockOrder(order.id);
    if (!res.success) {
      alert(res.error);
    } else {
      router.push('/inventory/orders');
    }
  };

  const handleDeleteItem = async (orderItemId: string, itemName: string) => {
    if (!confirm(`Remove "${itemName}" from this order?`)) return;
    const res = await deleteRestockOrderItem(orderItemId);
    if (!res.success) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  // 1-Click Vendor Email Generation
  const emailSubject = `Supply Restock Order — ${order.vendor.name} (${order.poNumber})`;
  const emailBody =
    `Hi ${order.vendor.contactPerson || order.vendor.name},\n\n` +
    `Please place an order for church supplies:\n` +
    `Purchase Order: ${order.poNumber}\n` +
    `Order Date: ${formatCalendarDate(order.orderDate) ?? formatCalendarDate(new Date())}\n\n` +
    `Items:\n` +
    order.items
      .map(
        (i) =>
          `• ${i.itemName} — ${i.quantityOrdered} ${i.unit} (Destination: ${i.buildingName} / ${i.roomName}${
            i.shelfLocation ? `, Shelf: ${i.shelfLocation}` : ''
          }${i.unitPrice ? `, Est: $${i.unitPrice.toFixed(2)}/ea` : ''})`
      )
      .join('\n') +
    (order.totalCost ? `\n\nEstimated Total: $${order.totalCost.toFixed(2)}` : '') +
    (order.notes ? `\nNotes: ${order.notes}` : '') +
    `\n\nThank you,\nChesterfield Presbyterian Church Facilities & Operations`;

  const mailtoUrl = `mailto:${order.vendor.email || ''}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody)}`;

  // 1-Click CSV Export Generation
  const handleExportCSV = () => {
    const headers = [
      'PO Number',
      'Supplier',
      'Item Name',
      'Category',
      'Building',
      'Room',
      'Shelf Location',
      'Quantity Ordered',
      'Quantity Received',
      'Unit',
      'Unit Price',
      'Total Cost',
    ];

    const rows = order.items.map((i) => [
      order.poNumber,
      order.vendor.name,
      i.itemName,
      i.categoryName || 'General',
      i.buildingName,
      i.roomName,
      i.shelfLocation || '',
      i.quantityOrdered.toString(),
      i.quantityReceived.toString(),
      i.unit,
      i.unitPrice !== null ? i.unitPrice.toFixed(2) : '',
      i.unitPrice !== null ? (i.unitPrice * i.quantityOrdered).toFixed(2) : '',
    ]);

    const escapeCSV = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent =
      [headers.map(escapeCSV).join(','), ...rows.map((r) => r.map(escapeCSV).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${order.poNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const isAmazon =
    order.vendor.name.toLowerCase().includes('amazon') ||
    Boolean(order.vendor.url && order.vendor.url.toLowerCase().includes('amazon'));

  function extractAsin(text: string | null | undefined): string | null {
    if (!text) return null;
    const match = text.match(/\b(B0[A-Z0-9]{8})\b/i) || text.match(/\/dp\/([A-Z0-9]{10})/i);
    return match ? match[1].toUpperCase() : null;
  }

  const amazonItemsWithAsin = order.items
    .map((item) => ({
      asin: extractAsin(item.shelfLocation) || extractAsin(item.itemName),
      qty: item.quantityOrdered,
    }))
    .filter((item): item is { asin: string; qty: number } => Boolean(item.asin));

  const amazonMultiCartUrl =
    amazonItemsWithAsin.length > 0
      ? 'https://www.amazon.com/gp/aws/cart/add.html?' +
        amazonItemsWithAsin
          .map((item, idx) => `ASIN.${idx + 1}=${item.asin}&Quantity.${idx + 1}=${item.qty}`)
          .join('&')
      : isAmazon
      ? `https://www.amazon.com/s?k=${encodeURIComponent(order.items[0]?.itemName || '')}`
      : null;

  return (
    <div className="space-y-8">
      {/* Top Back Nav & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/inventory/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Restock Orders
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {order.poNumber}
            </h1>
            {getStatusBadge(order.status)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
                    {/* 1-Click Amazon Multi-Cart */}
          {isAmazon && amazonMultiCartUrl && (
            <a
              href={amazonMultiCartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-sm transition-colors"
              title="Add all items into your Amazon Cart in 1 click"
            >
              <ShoppingCartIcon className="h-4 w-4" /> 1-Click Amazon Cart ({amazonItemsWithAsin.length}/{order.items.length})
            </a>
          )}

          {/* Email Export */}
          {order.vendor.email && (
            <a
              href={mailtoUrl}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <MailIcon className="h-4 w-4" /> 1-Click Vendor Email
            </a>
          )}

          {/* CSV Download */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <DownloadIcon className="h-4 w-4 text-slate-500" /> Export CSV
          </button>

          {/* Mark Received */}
          {canManage && order.status !== 'received' && (
            <button
              type="button"
              onClick={() => handleStatusChange('received')}
              disabled={statusLoading}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCheckIcon className="h-4 w-4" /> Mark Received
            </button>
          )}

          {/* Status selector */}
          {canManage && (
            <select
              value={order.status}
              disabled={statusLoading}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as 'draft' | 'ordered' | 'shipped' | 'received' | 'canceled'
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="draft">Draft</option>
              <option value="ordered">Ordered</option>
              <option value="shipped">Shipped</option>
              <option value="received">Received</option>
              <option value="canceled">Canceled</option>
            </select>
          )}

          {canManage && (
            <button
              type="button"
              onClick={handleDeleteOrder}
              className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
              title="Delete purchase order"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Overview Card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Vendor info */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <BuildingIcon className="h-4 w-4 text-slate-500" /> Supplier Information
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            {order.vendor.name}
          </h3>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {order.vendor.contactPerson && (
              <div>
                <span className="text-slate-400">Rep:</span> {order.vendor.contactPerson}
              </div>
            )}
            {order.vendor.email && (
              <div>
                <span className="text-slate-400">Email:</span>{' '}
                <a href={`mailto:${order.vendor.email}`} className="text-brand-600 hover:underline">
                  {order.vendor.email}
                </a>
              </div>
            )}
            {order.vendor.phone && (
              <div>
                <span className="text-slate-400">Phone:</span>{' '}
                <a href={`tel:${order.vendor.phone}`} className="hover:underline">
                  {order.vendor.phone}
                </a>
              </div>
            )}
            {order.vendor.url && (
              <div>
                <a
                  href={order.vendor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLinkIcon className="h-3 w-3" /> Supplier Order Portal
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Order Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dates &amp; Cost
            </div>
            {canManage && (
              <button
                onClick={() => setIsEditingNotes(!isEditingNotes)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {isEditingNotes ? 'Close' : 'Edit'}
              </button>
            )}
          </div>

          {!isEditingNotes ? (
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400">Order Date:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatCalendarDate(order.orderDate) ?? 'Not recorded'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Expected Delivery:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatCalendarDate(order.expectedDelivery) ?? 'Not specified'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Total Cost:</span>{' '}
                <strong className="text-base text-slate-900 dark:text-slate-100">
                  {order.totalCost !== null ? `$${order.totalCost.toFixed(2)}` : '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Created By:</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">
                  {order.orderedBy?.name || order.orderedBy?.email || 'System'}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500">Order Date</label>
                <input
                  type="date"
                  value={orderDateValue}
                  onChange={(e) => setOrderDateValue(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500">Expected Delivery</label>
                <input
                  type="date"
                  value={deliveryDateValue}
                  onChange={(e) => setDeliveryDateValue(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveDatesAndNotes}
                className="rounded bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* Order Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</div>
          {!isEditingNotes ? (
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              {order.notes || 'No notes added for this purchase order.'}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                rows={3}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Shipping instructions, invoice #, etc."
                className="w-full rounded border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleSaveDatesAndNotes}
                className="rounded bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Update Notes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Order Line Items ({order.items.length})
            </h2>
            <p className="text-xs text-slate-500">
              Supplies and quantities requested in this purchase order.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/30">
                <tr>
                  <th className="px-4 py-3">Item &amp; Category</th>
                  <th className="px-4 py-3">Destination Room</th>
                  <th className="px-4 py-3 text-right">Quantity Ordered</th>
                  <th className="px-4 py-3 text-right">Quantity Received</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                  {canManage && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.items.map((item) => {
                  const lineTotal =
                    item.unitPrice !== null ? item.unitPrice * item.quantityOrdered : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.itemName}
                        </div>
                        {item.categoryName && (
                          <div className="text-xs text-slate-400">{item.categoryName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.buildingName} &rsaquo; {item.roomName}
                        {item.shelfLocation && (
                          <div className="text-[11px] text-slate-400">📍 {item.shelfLocation}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                        {item.quantityOrdered} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {item.quantityReceived >= item.quantityOrdered && item.quantityOrdered > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                            <CheckIcon className="h-3.5 w-3.5" /> {item.quantityReceived} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {item.quantityReceived} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">
                        {item.unitPrice !== null ? `$${item.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {lineTotal !== null ? `$${lineTotal.toFixed(2)}` : '—'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Edit item quantities"
                            >
                              <EditIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.itemName)}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                              title="Delete line item"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {order.items.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-400">
              No items in this purchase order yet. Click &quot;Add Item&quot; to add supplies.
            </div>
          )}
        </div>
      </div>

      {/* ADD ITEM MODAL */}
      {isAddItemModalOpen && (
        <AddItemModal
          availableItems={availableVendorItems}
          onClose={() => setIsAddItemModalOpen(false)}
          onSubmit={async (data) => {
            await addRestockOrderItem(order.id, data);
            setIsAddItemModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={async (data) => {
            await updateRestockOrderItem(editingItem.id, data);
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddItemModal({
  availableItems,
  onClose,
  onSubmit,
}: {
  availableItems: AvailableItemOption[];
  onClose: () => void;
  onSubmit: (data: { itemId: string; quantityOrdered: number; unitPrice?: number }) => Promise<void>;
}) {
  const [itemId, setItemId] = useState(availableItems[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const selectedItem = availableItems.find((i) => i.id === itemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setLoading(true);
    await onSubmit({
      itemId,
      quantityOrdered: Number(quantity),
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Item to Order</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Select Item</label>
            <select
              required
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                const item = availableItems.find((i) => i.id === e.target.value);
                if (item && item.neededQty > 0) {
                  setQuantity(item.neededQty);
                }
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {availableItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.onHandQty}/{i.idealQty} {i.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Quantity {selectedItem ? `(${selectedItem.unit})` : ''}
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
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
              {loading ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  onSubmit,
}: {
  item: OrderDetailItem;
  onClose: () => void;
  onSubmit: (data: { quantityOrdered: number; quantityReceived: number; unitPrice?: number }) => Promise<void>;
}) {
  const [quantityOrdered, setQuantityOrdered] = useState(item.quantityOrdered);
  const [quantityReceived, setQuantityReceived] = useState(item.quantityReceived);
  const [unitPrice, setUnitPrice] = useState<string>(item.unitPrice !== null ? item.unitPrice.toString() : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      quantityOrdered: Number(quantityOrdered),
      quantityReceived: Number(quantityReceived),
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Line Item: {item.itemName}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Quantity Ordered ({item.unit})
              </label>
              <input
                type="number"
                min="0"
                required
                value={quantityOrdered}
                onChange={(e) => setQuantityOrdered(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Quantity Received ({item.unit})
              </label>
              <input
                type="number"
                min="0"
                value={quantityReceived}
                onChange={(e) => setQuantityReceived(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Unit Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 14.99"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
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
