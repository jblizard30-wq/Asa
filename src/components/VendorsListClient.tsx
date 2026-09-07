'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import {
  TruckIcon,
  MailIcon,
  PhoneIcon,
  ExternalLinkIcon,
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  ShoppingCartIcon,
} from '@/components/InventoryIcons';
import { createVendor, updateVendor, deleteVendor } from '@/lib/actions/inventory';

export interface VendorRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  notes: string | null;
  itemCount: number;
  neededItemCount: number;
  orderCount: number;
}

interface VendorsListClientProps {
  canManage: boolean;
  vendors: VendorRow[];
}

export function VendorsListClient({ canManage, vendors }: VendorsListClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase();
    return vendors.filter((v) => {
      return (
        v.name.toLowerCase().includes(q) ||
        (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.notes && v.notes.toLowerCase().includes(q))
      );
    });
  }, [vendors, searchQuery]);

  const vendorsNeedingRestock = vendors.filter((v) => v.neededItemCount > 0).length;

  const handleDelete = async (vendor: VendorRow) => {
    if (
      !confirm(
        `Are you sure you want to delete vendor "${vendor.name}"? Items assigned to this vendor will remain in inventory.`
      )
    ) {
      return;
    }

    const res = await deleteVendor(vendor.id);
    if (!res.success) {
      toast.error('Delete failed', res.error);
    } else {
      toast.success(`Deleted vendor "${vendor.name}"`);
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <TruckIcon className="h-4 w-4 text-emerald-500" />
            Supplier Directory
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Vendors &amp; Suppliers
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Maintain sales reps, order portals, and contact info for 1-click PO generation and retail replenishment.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <PlusIcon className="h-4 w-4" /> Add Supplier
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Suppliers</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {vendors.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Suppliers Needing Restock</div>
          <div
            className={`mt-1 text-2xl font-extrabold ${
              vendorsNeedingRestock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
            }`}
          >
            {vendorsNeedingRestock}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Purchase Orders</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-600 dark:text-brand-400">
            {vendors.reduce((sum, v) => sum + v.orderCount, 0)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search suppliers by name, rep, or notes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredVendors.map((vendor) => (
          <div
            key={vendor.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {vendor.name}
                  </h3>
                  {vendor.contactPerson && (
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Rep: {vendor.contactPerson}
                    </div>
                  )}
                </div>

                {vendor.neededItemCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {vendor.neededItemCount} below par
                  </span>
                )}
              </div>

              {/* Contact info links */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {vendor.email && (
                  <a
                    href={`mailto:${vendor.email}`}
                    className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <MailIcon className="h-3.5 w-3.5" />
                    <span>{vendor.email}</span>
                  </a>
                )}

                {vendor.phone && (
                  <a
                    href={`tel:${vendor.phone}`}
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-300"
                  >
                    <PhoneIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{vendor.phone}</span>
                  </a>
                )}

                {vendor.url && (
                  <a
                    href={vendor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                    <span>Online Portal</span>
                  </a>
                )}
              </div>

              {vendor.notes && (
                <p className="mt-3 text-xs text-slate-500 line-clamp-2">{vendor.notes}</p>
              )}
            </div>

            {/* Card Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <span className="text-slate-400">
                {vendor.itemCount} SKUs &middot; {vendor.orderCount} POs
              </span>

              <div className="flex items-center gap-3">
                <Link
                  href={`/inventory/orders?vendor=${vendor.id}`}
                  className="flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  <ShoppingCartIcon className="h-3.5 w-3.5" /> POs
                </Link>

                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setModalError(null);
                        setEditingVendor(vendor);
                      }}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      title="Edit Vendor"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(vendor)}
                      className="text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete Vendor"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredVendors.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400 dark:border-slate-700">
            {vendors.length === 0
              ? 'No suppliers added yet. Create your first supplier to organize purchase orders.'
              : 'No suppliers match your search query.'}
          </div>
        )}
      </div>

      {/* ADD / EDIT VENDOR MODAL */}
      {(isAddModalOpen || editingVendor) && (
        <VendorFormModal
          title={editingVendor ? `Edit "${editingVendor.name}"` : 'Add New Supplier'}
          initialData={
            editingVendor
              ? {
                  name: editingVendor.name,
                  contactPerson: editingVendor.contactPerson || '',
                  phone: editingVendor.phone || '',
                  email: editingVendor.email || '',
                  url: editingVendor.url || '',
                  notes: editingVendor.notes || '',
                }
              : undefined
          }
          error={modalError}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingVendor(null);
          }}
          onSubmit={async (data) => {
            setModalError(null);
            if (editingVendor) {
              const res = await updateVendor(editingVendor.id, data);
              if (!res.success) {
                setModalError(res.error);
                return;
              }
              setEditingVendor(null);
            } else {
              const res = await createVendor(data);
              if (!res.success) {
                setModalError(res.error);
                return;
              }
              setIsAddModalOpen(false);
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

interface VendorFormData {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  url?: string;
  notes?: string;
}

function VendorFormModal({
  title,
  initialData,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  initialData?: VendorFormData;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: VendorFormData) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData?.name || '');
  const [contactPerson, setContactPerson] = useState(initialData?.contactPerson || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      url: url.trim() || undefined,
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
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Supplier Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. The Bean Doctor, All Type Vacuum, Sam's Club"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Contact Person / Sales Rep
            </label>
            <input
              type="text"
              placeholder="e.g. Chris Hanson, Paul Unger"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                placeholder="rep@supplier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="636-555-0199"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Online Ordering Portal URL
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Internal Notes
            </label>
            <textarea
              rows={2}
              placeholder="Account number, delivery instructions, payment terms…"
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
              {loading ? 'Saving…' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
