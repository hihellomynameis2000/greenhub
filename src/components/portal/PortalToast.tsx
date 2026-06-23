"use client";

import { Check } from "lucide-react";
import { type ButtonHTMLAttributes, useEffect, useState } from "react";

type ToastContent = {
  message: string;
  title: string;
};

type PortalActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  toastMessage: string;
  toastTitle: string;
};

const toastEventName = "greenhub:toast";

export function showPortalToast(toast: ToastContent) {
  window.dispatchEvent(
    new CustomEvent<ToastContent>(toastEventName, { detail: toast })
  );
}

export function PortalActionButton({
  children,
  onClick,
  toastMessage,
  toastTitle,
  ...buttonProps
}: PortalActionButtonProps) {
  return (
    <button
      {...buttonProps}
      onClick={(event) => {
        const result = onClick?.(event);
        if (event.defaultPrevented) return;

        Promise.resolve(result)
          .then(() => showPortalToast({ message: toastMessage, title: toastTitle }))
          .catch(() => undefined);
      }}
    >
      {children}
    </button>
  );
}

export function PortalToastViewport() {
  const [toast, setToast] = useState<ToastContent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleToast(event: Event) {
      const { detail } = event as CustomEvent<ToastContent>;
      if (!detail?.message || !detail.title) return;

      setVisible(false);
      setToast(detail);
      window.setTimeout(() => setVisible(true), 20);
    }

    window.addEventListener(toastEventName, handleToast);
    return () => window.removeEventListener(toastEventName, handleToast);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const hideTimer = window.setTimeout(() => setVisible(false), 3600);
    const clearTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2.5rem)]"
    >
      <div
        role="status"
        className={`flex min-w-72 items-center gap-3 rounded-lg border border-emerald-700 bg-emerald-800 px-4 py-3 text-white shadow-lg shadow-emerald-950/20 transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700">
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-0.5 text-xs text-emerald-100">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
