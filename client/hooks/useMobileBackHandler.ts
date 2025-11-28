import { useEffect } from "react";

/**
 * Mobile back button handler - initializes Telegram WebApp
 */
export default function useMobileBackHandler() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  return null;
}
