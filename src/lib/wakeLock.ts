let wakeLockSentinel: WakeLockSentinel | null = null;

export async function requestScreenWakeLock(): Promise<boolean> {
  if ("wakeLock" in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return true;
    } catch (err) {
      console.warn("Screen Wake Lock request failed:", err);
      return false;
    }
  }
  return false;
}

export async function releaseScreenWakeLock(): Promise<void> {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release error
    }
    wakeLockSentinel = null;
  }
}

async function handleVisibilityChange() {
  if (document.visibilityState === "visible" && !wakeLockSentinel) {
    await requestScreenWakeLock();
  }
}
