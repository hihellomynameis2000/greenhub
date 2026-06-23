"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { portalRequest } from "@/lib/portal/client";
import { usePortalData } from "./PortalDataProvider";

export function PortalNotificationMenu({ role }: { role: "admin" | "agent" }) {
  const { data, refresh } = usePortalData();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifications = role === "agent" ? data?.notifications ?? [] : [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    if (!open) return;

    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && role === "agent" && unreadCount) {
      try {
        await portalRequest("/api/portal/notifications", { method: "PATCH" });
        await refresh();
      } catch {
        // The inbox remains readable even if read-state persistence is unavailable.
      }
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open notifications"
        title="Notifications"
        onClick={toggleNotifications}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      >
        <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        {unreadCount ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-300/50"
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">Notifications</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {role === "agent" ? "Residual reporting updates" : "No admin notifications"}
            </p>
          </div>
          {notifications.length ? (
            notifications.map((notification) => (
              <div key={notification.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                <p className="text-sm font-semibold text-slate-950">
                  {notification.title ?? "Residuals updated"}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-700">
                  {notification.message ?? "Your finalized residuals are ready to review."}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(notification.created_at))}
                </p>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-slate-600">No notifications to show.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
