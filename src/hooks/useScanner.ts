import { useEffect, useRef } from "react";

export interface ScannerConfig {
  onScan: (barcode: string) => void;
  maxInterKeyDelayMs?: number; // Default: 30ms for hardware scanners
  minBarcodeLength?: number;   // Default: 6 chars
  debounceMs?: number;         // Default: 800ms
  enabled?: boolean;
}

/**
 * Global keyboard listener hook for hardware 2D barcode/QR scanners (e.g. Helett HT20 USB-OTG/BT).
 * Captures rapid keystroke bursts and invokes onScan with the clean raw token string.
 *
 * Exempts editable input fields so form typing and modal search are not swallowed.
 */
export function useScanner({
  onScan,
  maxInterKeyDelayMs = 30,
  minBarcodeLength = 6,
  debounceMs = 800,
  enabled = true,
}: ScannerConfig) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const lastScanTimeRef = useRef<number>(0);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create and attach off-screen input for mobile devices
    let hiddenInput = document.getElementById("scanner-anchor-input") as HTMLInputElement | null;
    if (!hiddenInput) {
      hiddenInput = document.createElement("input");
      hiddenInput.id = "scanner-anchor-input";
      hiddenInput.setAttribute("inputmode", "none");
      hiddenInput.setAttribute("tabindex", "-1");
      hiddenInput.setAttribute("aria-hidden", "true");
      hiddenInput.style.position = "absolute";
      hiddenInput.style.opacity = "0";
      hiddenInput.style.pointerEvents = "none";
      hiddenInput.style.left = "-9999px";
      hiddenInput.style.top = "-9999px";
      document.body.appendChild(hiddenInput);
    }
    hiddenInputRef.current = hiddenInput;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Form element exemption: If typing in an active input or textarea, pass through normally
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target !== hiddenInput &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 2. Hardware timing heuristic:
      // If time between keystrokes is too large, reset buffer (it was human typing)
      if (timeDiff > maxInterKeyDelayMs && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        const scannedCode = bufferRef.current.trim();
        bufferRef.current = "";

        if (scannedCode.length >= minBarcodeLength) {
          e.preventDefault();
          e.stopPropagation();

          // Debounce check
          if (now - lastScanTimeRef.current < debounceMs) {
            return;
          }
          lastScanTimeRef.current = now;

          // Normalization fallback: if someone scanned an accidental full URL, extract the trailing token
          const cleanToken = extractToken(scannedCode);
          onScan(cleanToken);
        }
      } else if (e.key.length === 1) {
        // Append printable character
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onScan, maxInterKeyDelayMs, minBarcodeLength, debounceMs, enabled]);

  return { hiddenInputRef };
}

/**
 * Extracts raw token if an incoming scan contains a URL prefix, otherwise returns trimmed string.
 */
export function extractToken(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const parts = trimmed.split("/t/");
    if (parts.length > 1) {
      return parts[1].split("?")[0].split("#")[0].trim();
    }
  }
  return trimmed;
}
