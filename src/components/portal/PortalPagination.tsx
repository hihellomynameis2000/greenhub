"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

type PortalPaginationProps = {
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
};

type PageItem = number | "start-ellipsis" | "end-ellipsis";

function paginationItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("start-ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push("end-ellipsis");

  items.push(pageCount);
  return items;
}

export function PortalPagination({
  onPageChange,
  page,
  pageCount,
  pageSize,
  totalItems,
}: PortalPaginationProps) {
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  const buttonClass =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label="Table pagination"
      className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-slate-600">
        Showing <span className="font-semibold text-slate-900">{firstItem}-{lastItem}</span> of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className={`${buttonClass} text-slate-600 hover:bg-slate-100 hover:text-slate-950`}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        {paginationItems(page, pageCount).map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={`${buttonClass} ${
                item === page
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              aria-hidden="true"
              className="inline-flex h-8 w-6 items-center justify-center text-slate-400"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          className={`${buttonClass} text-slate-600 hover:bg-slate-100 hover:text-slate-950`}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
