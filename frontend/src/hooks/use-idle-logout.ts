import { useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  timeoutMs: number;
  warnMs?: number;
  onWarn?: () => void;
  onTimeout: () => void;
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

export function useIdleLogout({ enabled, timeoutMs, warnMs, onWarn, onTimeout }: Options) {
  const lastActivity = useRef<number>(Date.now());
  const warned = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      lastActivity.current = Date.now();
      warned.current = false;
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (warnMs && onWarn && !warned.current && idle >= timeoutMs - warnMs && idle < timeoutMs) {
        warned.current = true;
        onWarn();
      }
      if (idle >= timeoutMs) {
        clearInterval(id);
        onTimeout();
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(id);
    };
  }, [enabled, timeoutMs, warnMs, onWarn, onTimeout]);
}
