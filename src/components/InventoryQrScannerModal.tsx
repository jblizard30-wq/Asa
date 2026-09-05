'use client';

import { useState, useRef, useEffect } from 'react';
import { QrCodeIcon, AlertTriangleIcon } from '@/components/InventoryIcons';

interface InventoryQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

export function InventoryQrScannerModal({ isOpen, onClose, onScanned }: InventoryQrScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsScanning(false);
      setCameraError(null);
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera access not supported by this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsScanning(true);
        }

        // Check for BarcodeDetector API
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
                if (detected) {
                  clearInterval(scanInterval);
                  onScanned(detected);
                }
              }
            } catch {
              // Frame dropped or not ready
            }
          }, 350);
        }
      } catch (err: unknown) {
        setCameraError('Camera permission denied or camera not found.');
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
  }, [isOpen, onScanned]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanned(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Scan Shelf QR or Barcode</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Video Viewport */}
        <div className="mt-4 relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <AlertTriangleIcon className="mx-auto h-6 w-6 text-amber-500 mb-2" />
              <p>{cameraError}</p>
              <p className="mt-1 text-[11px] text-slate-500">You can type or paste the code below.</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="absolute inset-8 rounded-lg border-2 border-brand-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none" />
              {isScanning && (
                <div className="absolute top-2 right-2 rounded bg-emerald-500/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Camera Active
                </div>
              )}
            </>
          )}
        </div>

        {/* Manual Barcode / Code Entry */}
        <form onSubmit={handleManualSubmit} className="mt-5 space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Or Enter Code / Item Name Manually
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. B0012345, Coffee 12oz, Shelf A1..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700"
            >
              Lookup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
