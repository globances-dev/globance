import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export function KeyboardToolbar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        setIsVisible(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || !["INPUT", "TEXTAREA"].includes(active.tagName)) {
          setIsVisible(false);
        }
      }, 100);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const hideKeyboard = () => {
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }
    setIsVisible(false);
  };

  return (
    <div 
      className={`fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none transition-opacity duration-150 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <button
        onClick={hideKeyboard}
        className="pointer-events-auto mb-1 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95"
        style={{
          backgroundColor: "rgba(24, 26, 32, 0.95)",
          color: "#848E9C",
          border: "1px solid rgba(132, 142, 156, 0.15)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
        }}
      >
        <span>Hide Keyboard</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
