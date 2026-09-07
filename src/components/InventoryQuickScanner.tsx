'use client';

import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { useToast } from '@/components/Toast';
import {
  QrCodeIcon,
  AlertTriangleIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  SearchIcon,
  MapPinIcon,
  PackageIcon,
  SparklesIcon,
} from '@/components/InventoryIcons';
import { submitStockCount } from '@/lib/actions/inventory';
import { getSurgedParLevel } from '@/lib/liturgicalCalendar';

export interface QuickScannerItem {
  id: string;
  name: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  neededQty?: number;
  reorderThreshold: number;
  shelfLocation: string | null;
  roomId: string;
  room: {
    id: string;
    name: string;
    buildingId?: string;
    building?: {
      id: string;
      name: string;
    };
  };
  inventoryTypeId?: string | null;
  inventoryType?: {
    id?: string;
    name: string;
    slug?: string;
    icon?: string | null;
  } | null;
  isSurged?: boolean;
  surgedParLevel?: number;
  surgeBadgeText?: string | null;
  notes?: string | null;
}

interface InventoryQuickScannerProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuickScannerItem[];
  onCountSaved?: (itemId: string, newOnHandQty: number) => void;
}

export function InventoryQuickScanner({
  isOpen,
  onClose,
  items,
  onCountSaved,
}: InventoryQuickScannerProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Mode and Camera state
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [manualInput, setManualInput] = useState('');

  // Active item & matched list state
  const [matchedItems, setMatchedItems] = useState<QuickScannerItem[]>([]);
  const [activeItem, setActiveItem] = useState<QuickScannerItem | null>(null);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [matchedContext, setMatchedContext] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Session audit log (items counted during this session)
  const [recentAudits, setRecentAudits] = useState<
    Array<{ id: string; name: string; qty: number; unit: string; time: string }>
  >([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize code strings for comparison
  const normalize = (val: string) => val.trim().toLowerCase().replace(/[\s\-_]+/g, '');

  // Select an item to audit
  const selectItemForAudit = useCallback((item: QuickScannerItem) => {
    setActiveItem(item);
    setCurrentCount(item.onHandQty);
    setSaveStatus('idle');
  }, []);

  // Match scanned or typed code to item(s)
  const handleCodeLookup = useCallback(
    (code: string) => {
      const raw = code.trim();
      if (!raw) return;
      setLastScannedCode(raw);

      const norm = normalize(raw);

      // 1. Exact Item ID match
      const exactIdMatch = items.find((i) => i.id === raw || normalize(i.id) === norm);
      if (exactIdMatch) {
        setMatchedItems([exactIdMatch]);
        setMatchedContext(`Item Code: ${raw}`);
        selectItemForAudit(exactIdMatch);
        return;
      }

      // 2. Shelf / Cabinet location match (e.g. ROOM-FH-CAB-B, CAB-B, Under Sink)
      const shelfMatches = items.filter((i) => {
        if (!i.shelfLocation) return false;
        const normShelf = normalize(i.shelfLocation);
        return normShelf === norm || normShelf.includes(norm) || norm.includes(normShelf);
      });

      if (shelfMatches.length > 0) {
        setMatchedItems(shelfMatches);
        setMatchedContext(`Shelf: ${shelfMatches[0].shelfLocation} (${shelfMatches.length} items)`);
        selectItemForAudit(shelfMatches[0]);
        return;
      }

      // 3. Room name match (e.g. ROOM-FH, Kitchen, Coffeehouse)
      const roomMatches = items.filter((i) => {
        const normRoom = normalize(i.room.name);
        return normRoom === norm || norm.includes(normRoom);
      });

      if (roomMatches.length > 0) {
        setMatchedItems(roomMatches);
        setMatchedContext(`Room: ${roomMatches[0].room.name} (${roomMatches.length} items)`);
        selectItemForAudit(roomMatches[0]);
        return;
      }

      // 4. Item Name search
      const nameMatches = items.filter((i) => {
        const normName = normalize(i.name);
        return normName.includes(norm);
      });

      if (nameMatches.length > 0) {
        setMatchedItems(nameMatches);
        setMatchedContext(`Search: "${raw}" (${nameMatches.length} matches)`);
        selectItemForAudit(nameMatches[0]);
        return;
      }

      // No match found
      setMatchedItems([]);
      setActiveItem(null);
      setMatchedContext(`No items mapped to "${raw}"`);
      toast.error('Scan Not Found', `No item or shelf location matches "${raw}"`);
    },
    [items, selectItemForAudit, toast]
  );

  // Camera lifecycle & barcode detection
  useEffect(() => {
    if (!isOpen || !cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera access not supported on this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Use standard BarcodeDetector if supported
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
          });

          const scanInterval = setInterval(async () => {
            if (!videoRef.current || !isMounted) {
              clearInterval(scanInterval);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                if (detected && detected !== lastScannedCode) {
                  // Haptic feedback if supported
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try {
                      navigator.vibrate(50);
                    } catch {}
                  }
                  handleCodeLookup(detected);
                }
              }
            } catch {
              // Frame dropped or busy
            }
          }, 400);
        }
      } catch (err: unknown) {
        setCameraError('Camera permission denied or camera not available.');
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, cameraActive, handleCodeLookup, lastScannedCode]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Save stock count
  const persistCount = useCallback(
    (item: QuickScannerItem, qty: number) => {
      setSaveStatus('saving');
      startTransition(async () => {
        const res = await submitStockCount({ itemId: item.id, qty });
        if (res.success) {
          setSaveStatus('saved');
          toast.success('Count Recorded', `${item.name}: ${qty} ${item.unit}`);

          // Update local item onHandQty
          item.onHandQty = qty;
          onCountSaved?.(item.id, qty);

          // Add to recent audit history
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setRecentAudits((prev) => [
            { id: item.id, name: item.name, qty, unit: item.unit, time: timeStr },
            ...prev.filter((r) => r.id !== item.id).slice(0, 4),
          ]);
        } else {
          setSaveStatus('idle');
          toast.error('Count Failed', res.error);
        }
      });
    },
    [onCountSaved, toast]
  );

  // Stepper increment / decrement with debounce auto-save
  const handleStepCount = (delta: number) => {
    if (!activeItem) return;
    const nextQty = Math.max(0, currentCount + delta);
    setCurrentCount(nextQty);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      persistCount(activeItem, nextQty);
    }, 450);
  };

  // Direct numeric input
  const handleDirectCountChange = (val: number) => {
    if (!activeItem) return;
    const nextQty = Math.max(0, val);
    setCurrentCount(nextQty);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      persistCount(activeItem, nextQty);
    }, 600);
  };

  // Immediate save on preset click
  const handleApplyPreset = (targetQty: number) => {
    if (!activeItem) return;
    const nextQty = Math.max(0, targetQty);
    setCurrentCount(nextQty);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    persistCount(activeItem, nextQty);
  };

  if (!isOpen) return null;

  // Compute surge status for active item
  const activeSurge = activeItem ? getSurgedParLevel(activeItem) : null;
  const effectivePar = activeSurge?.isSurged
    ? activeSurge.surgedParLevel
    : activeItem?.idealQty ?? 0;
  const isBelowPar = activeItem ? currentCount < effectivePar : false;
  const isCritical =
    activeItem && activeItem.reorderThreshold > 0
      ? currentCount <= activeItem.reorderThreshold
      : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
      <div className="flex h-full max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <QrCodeIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                Quick-Audit Scanner
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Scan shelf/item QR or enter code to record counts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Scanner Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Camera Viewport / Toggle Banner */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${cameraActive && !cameraError ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="font-semibold text-[11px]">
                  {cameraActive && !cameraError ? 'Camera Scanner Active' : 'Camera Paused'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className="text-[11px] font-medium text-brand-400 hover:text-brand-300"
              >
                {cameraActive ? 'Minimize Camera' : 'Open Camera'}
              </button>
            </div>

            {cameraActive && (
              <div className="relative aspect-video w-full flex items-center justify-center bg-black">
                {cameraError ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    <AlertTriangleIcon className="mx-auto h-6 w-6 text-amber-500 mb-2" />
                    <p>{cameraError}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Use the rapid shelf &amp; code search below.
                    </p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    {/* Targeting Reticle */}
                    <div className="pointer-events-none absolute inset-6 sm:inset-10 rounded-xl border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                      <div className="h-0.5 w-full bg-emerald-400/70 shadow-[0_0_8px_#34d399] animate-pulse" />
                    </div>
                    <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                      <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur">
                        Align shelf QR code or item barcode
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rapid Manual Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCodeLookup(manualInput);
            }}
            className="space-y-1.5"
          >
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Scan or enter code (e.g. ROOM-FH-CAB-B, Wafers)..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700"
              >
                Lookup
              </button>
            </div>
            {matchedContext && (
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {matchedContext}
              </div>
            )}
          </form>

          {/* Multiple Matches on this Shelf/Search: Quick Select Pills */}
          {matchedItems.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Items at this location ({matchedItems.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matchedItems.map((item) => {
                  const isSelected = activeItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItemForAudit(item)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Item Audit Card */}
          {activeItem ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {/* Seasonal Surge Badge */}
              {activeSurge?.isSurged && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
                  <SparklesIcon className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  <span>{activeSurge.badgeText || '⚡ Lent/Easter Par Surge Active'}</span>
                  <span className="text-[11px] font-normal text-purple-700 dark:text-purple-400">
                    (+50% for {activeSurge.feastName})
                  </span>
                </div>
              )}

              {/* Title & Metadata */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeItem.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3 text-slate-400" />
                      {activeItem.room.building?.name ? `${activeItem.room.building.name} › ` : ''}
                      {activeItem.room.name}
                    </span>
                    {activeItem.shelfLocation && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Shelf: {activeItem.shelfLocation}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Status Badge */}
                <div>
                  {isCritical ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                      Critical Low
                    </span>
                  ) : isBelowPar ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Below Par
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      In Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Par Level Info */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">Par Target: </span>
                  <strong className="font-bold text-slate-900 dark:text-white">
                    {effectivePar} {activeItem.unit}
                  </strong>
                  {activeSurge?.isSurged && (
                    <span className="ml-1 text-[11px] text-purple-600 dark:text-purple-400">
                      (Base: {activeItem.idealQty})
                    </span>
                  )}
                </div>
                {activeItem.reorderThreshold > 0 && (
                  <div className="text-[11px] text-slate-500">
                    Reorder at &le; {activeItem.reorderThreshold}
                  </div>
                )}
              </div>

              {/* Big Stepper Counting Controls */}
              <div className="mt-5 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  On Hand Quantity
                </div>

                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleStepCount(-1)}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Decrease 1"
                  >
                    <MinusIcon className="h-6 w-6" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={currentCount}
                    onChange={(e) => handleDirectCountChange(parseInt(e.target.value) || 0)}
                    className="h-16 w-24 rounded-2xl border-2 border-brand-500 bg-brand-50/20 text-center text-3xl font-black text-slate-900 shadow-inner focus:outline-none dark:bg-brand-950/20 dark:text-white"
                  />

                  <button
                    type="button"
                    onClick={() => handleStepCount(1)}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-600"
                    title="Increase 1"
                  >
                    <PlusIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(effectivePar)}
                    className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    Set to Par ({effectivePar})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(0)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Zero (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepCount(5)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepCount(10)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    +10
                  </button>
                </div>

                {/* Save Feedback Status */}
                <div className="mt-3 text-xs font-medium">
                  {saveStatus === 'saving' || isPending ? (
                    <span className="text-slate-400">Saving count to database…</span>
                  ) : saveStatus === 'saved' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon className="h-3.5 w-3.5" /> Count saved &amp; logged
                    </span>
                  ) : (
                    <span className="text-slate-400">Counts save automatically</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Blank state awaiting scan */
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 dark:border-slate-700">
              <PackageIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                No Item Selected
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Point camera at a shelf QR label or enter a shelf code (e.g. ROOM-FH-CAB-B) to begin
                counting.
              </p>
            </div>
          )}

          {/* Recent Audits in this Session */}
          {recentAudits.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Recent Audits (This Session)
              </div>
              <div className="space-y-1.5">
                {recentAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                  >
                    <span className="truncate font-medium">{audit.name}</span>
                    <span className="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">
                      {audit.qty} {audit.unit}{' '}
                      <span className="font-normal text-[10px] text-slate-400">({audit.time})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-right dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Done Auditing
          </button>
        </div>
      </div>
    </div>
  );
}
