"use client";

import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type LucideIcon } from "lucide-react";
import { portalInputClass } from "./portalFieldStyles";

export type PortalSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type PortalSelectProps = {
  ariaLabel?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  leadingIcon?: LucideIcon;
  onValueChange?: (value: string) => void;
  options: PortalSelectOption[];
  value?: string;
};

export function PortalSelect({
  ariaLabel,
  className = "",
  defaultValue,
  disabled = false,
  leadingIcon: LeadingIcon,
  onValueChange,
  options,
  value,
}: PortalSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? ""
  );
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLSpanElement>(null);
  const listboxRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.max(rect.width, 160);
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const openBelow = availableBelow >= 180 || availableBelow >= availableAbove;
    const maxHeight = Math.min(288, Math.max(140, openBelow ? availableBelow : availableAbove));
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );
    const top = openBelow
      ? rect.bottom + 6
      : Math.max(viewportPadding, rect.top - maxHeight - 6);

    setMenuStyle({
      left,
      maxHeight,
      top,
      width: menuWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !listboxRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  function selectOption(option: PortalSelectOption) {
    if (option.disabled) return;

    if (value === undefined) setInternalValue(option.value);
    onValueChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
            className="fixed z-[1000] block overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40"
          >
            {options.map((option) => {
              const selected = option.value === selectedValue;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onClick={() => selectOption(option)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "bg-emerald-50 font-semibold text-emerald-950"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              );
            })}
          </span>,
          document.body
        )
      : null;

  return (
    <span ref={containerRef} className="relative block w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex w-full items-center justify-between gap-3 ${portalInputClass} ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {LeadingIcon ? (
            <LeadingIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-500"
              strokeWidth={1.8}
            />
          ) : null}
          <span className="truncate text-left">{selectedOption?.label}</span>
        </span>
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 -translate-y-0.5 rotate-45 border-b-2 border-r-2 border-slate-400"
        />
      </button>
      {menu}
    </span>
  );
}
