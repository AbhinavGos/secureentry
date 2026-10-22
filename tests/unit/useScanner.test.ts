import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScanner, extractToken } from "../../src/hooks/useScanner";

describe("useScanner & extractToken", () => {
  describe("extractToken", () => {
    it("should return raw token string unchanged", () => {
      expect(extractToken("V1StGXR8_Z5j")).toBe("V1StGXR8_Z5j");
      expect(extractToken("ATT-409")).toBe("ATT-409");
      expect(extractToken("  ABC123XYZ  ")).toBe("ABC123XYZ");
    });

    it("should extract token from full URL path /t/:ticketCode", () => {
      expect(extractToken("https://events.wiserstack.com/t/V1StGXR8_Z5j")).toBe(
        "V1StGXR8_Z5j"
      );
      expect(extractToken("http://localhost:3000/t/ATT-409")).toBe("ATT-409");
    });

    it("should strip query parameters and hash anchors from URL", () => {
      expect(
        extractToken(
          "https://events.wiserstack.com/t/ATT-409?ref=whatsapp&rm=priya#confirm"
        )
      ).toBe("ATT-409");
    });
  });

  describe("useScanner Hook", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      document.body.innerHTML = "";
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should capture rapid keystroke burst and invoke onScan on Enter", () => {
      const onScan = vi.fn();
      renderHook(() =>
        useScanner({
          onScan,
          maxInterKeyDelayMs: 30,
          minBarcodeLength: 6,
          debounceMs: 500,
        })
      );

      const barcode = "V1StGXR8_Z5j";

      // Simulate rapid scanner burst (< 30ms between keys)
      act(() => {
        for (const char of barcode) {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          );
          vi.advanceTimersByTime(5); // 5ms burst
        }
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });

      expect(onScan).toHaveBeenCalledTimes(1);
      expect(onScan).toHaveBeenCalledWith("V1StGXR8_Z5j");
    });

    it("should exempt editable input elements from scanner interception", () => {
      const onScan = vi.fn();
      renderHook(() =>
        useScanner({
          onScan,
          maxInterKeyDelayMs: 30,
          minBarcodeLength: 6,
        })
      );

      const formInput = document.createElement("input");
      formInput.id = "search-input";
      document.body.appendChild(formInput);

      act(() => {
        for (const char of "V1StGXR8_Z5j") {
          formInput.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          );
          vi.advanceTimersByTime(5);
        }
        formInput.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });

      // Must be 0 calls because typing occurred inside an active form input
      expect(onScan).not.toHaveBeenCalled();
    });

    it("should debounce repeated scans within debounceMs window", () => {
      const onScan = vi.fn();
      renderHook(() =>
        useScanner({
          onScan,
          maxInterKeyDelayMs: 30,
          minBarcodeLength: 6,
          debounceMs: 800,
        })
      );

      // First scan
      act(() => {
        for (const char of "V1StGXR8_Z5j") {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          );
          vi.advanceTimersByTime(5);
        }
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });

      expect(onScan).toHaveBeenCalledTimes(1);

      // Second identical scan within 200ms (< 800ms debounce)
      act(() => {
        vi.advanceTimersByTime(200);
        for (const char of "V1StGXR8_Z5j") {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          );
          vi.advanceTimersByTime(5);
        }
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });

      // Still only 1 call
      expect(onScan).toHaveBeenCalledTimes(1);

      // Advance past debounce window (801ms)
      act(() => {
        vi.advanceTimersByTime(850);
        for (const char of "V1StGXR8_Z5j") {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          );
          vi.advanceTimersByTime(5);
        }
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });

      expect(onScan).toHaveBeenCalledTimes(2);
    });

    it("should reset buffer if keystrokes exceed maxInterKeyDelayMs (human typing)", () => {
      const onScan = vi.fn();
      renderHook(() =>
        useScanner({
          onScan,
          maxInterKeyDelayMs: 30,
          minBarcodeLength: 6,
        })
      );

      act(() => {
        // Human typing slowly (> 30ms between keystrokes)
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "V", bubbles: true }));
        vi.advanceTimersByTime(100);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
        vi.advanceTimersByTime(100);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "S", bubbles: true }));
        vi.advanceTimersByTime(100);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });

      // Buffer was reset between keys, length < 6, so onScan is not triggered
      expect(onScan).not.toHaveBeenCalled();
    });
  });
});
