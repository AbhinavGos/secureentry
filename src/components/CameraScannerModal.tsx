import React, { useEffect, useRef, useState } from "react";
import { X, Camera, Flashlight, AlertCircle, RefreshCw } from "lucide-react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { extractToken } from "../hooks/useScanner";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (token: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<number>(0);
  const isScanningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      isScanningRef.current = false;
      return;
    }

    let isMounted = true;
    const codeReader = new BrowserQRCodeReader();

    const startScanner = async () => {
      try {
        setError(null);
        if (!videoRef.current) return;

        // Discover video cameras
        const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices();
        if (isMounted) {
          setDevices(videoInputDevices);
        }

        let targetDeviceId: string | undefined = undefined;

        if (videoInputDevices.length > 0) {
          // If device index explicitly chosen
          if (videoInputDevices[selectedDeviceIndex]) {
            targetDeviceId = videoInputDevices[selectedDeviceIndex].deviceId;
          } else {
            // Find back / environment camera
            const backCamera = videoInputDevices.find((d) =>
              /back|rear|environment/i.test(d.label)
            );
            targetDeviceId =
              backCamera?.deviceId ?? videoInputDevices[videoInputDevices.length - 1]?.deviceId;
          }
        }

        const controls = await codeReader.decodeFromVideoDevice(
          targetDeviceId,
          videoRef.current,
          (result) => {
            if (result && isMounted && !isScanningRef.current) {
              const text = result.getText();
              if (text && text.trim().length > 0) {
                isScanningRef.current = true;
                if ("vibrate" in navigator) {
                  navigator.vibrate(120);
                }
                const token = extractToken(text);
                onScan(token);
              }
            }
          }
        );

        if (isMounted) {
          controlsRef.current = controls;

          // Check if torch/flashlight is supported
          const stream = videoRef.current.srcObject as MediaStream | null;
          const track = stream?.getVideoTracks()[0];
          const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
          if (capabilities && "torch" in capabilities) {
            setHasTorch(true);
          }
        } else {
          controls.stop();
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to access camera. Please verify camera permissions."
          );
        }
      }
    };

    void startScanner();

    return () => {
      isMounted = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [isOpen, selectedDeviceIndex, onScan]);

  const toggleTorch = async () => {
    if (!videoRef.current) return;
    const stream = videoRef.current.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as MediaTrackConstraintSet],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn("Flashlight toggle failed:", err);
      }
    }
  };

  const flipCamera = () => {
    if (devices.length <= 1) return;
    setSelectedDeviceIndex((prev) => (prev + 1) % devices.length);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-800/80 text-white z-10">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-wiser-blue" />
            <h3 className="font-semibold text-base">Camera Viewfinder</h3>
          </div>
          <div className="flex items-center gap-2">
            {devices.length > 1 && (
              <button
                type="button"
                onClick={flipCamera}
                className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-full transition ${
                  torchOn ? "bg-amber-400 text-slate-900" : "bg-slate-700 text-white"
                }`}
                title="Toggle Flashlight"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Video Area */}
        <div className="relative aspect-[4/5] bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-red-400 flex flex-col items-center gap-2">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Aiming Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-emerald-400/80 rounded-2xl relative shadow-lg shadow-emerald-400/20 animate-pulse">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-800 text-center text-xs text-slate-300">
          Align QR code pass within the green target frame
        </div>
      </div>
    </div>
  );
};
