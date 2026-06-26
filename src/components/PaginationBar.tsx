/**
 * Shared footer bar (matches Events list): “Showing X–Y of Z” + ← Prev / Next →
 */
type PaginationBarProps = {
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  emptyLabel?: string;
  itemLabel?: string;
  className?: string;
};

export default function PaginationBar({
  totalCount,
  page,
  pageSize,
  onPageChange,
  emptyLabel = "No records to show.",
  itemLabel = "",
  className = "",
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalCount);
  const suffix = itemLabel ? ` ${itemLabel}` : "";

  return (
    <div
      className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 text-sm text-gray-500 ${className}`.trim()}
    >
      <span>
        {totalCount === 0
          ? emptyLabel
          : `Showing ${start}–${end} of ${totalCount}${suffix}`}
      </span>
      <div className="flex gap-2 [&_button]:cursor-pointer">
        <button
          type="button"
          disabled={safePage <= 1 || totalCount === 0}
          onClick={() => onPageChange(safePage - 1)}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages || totalCount === 0}
          onClick={() => onPageChange(safePage + 1)}
          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
