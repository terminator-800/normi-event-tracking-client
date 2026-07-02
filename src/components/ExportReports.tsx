import { useState, type ButtonHTMLAttributes, type MouseEventHandler, type ReactNode } from "react";

type ExportAction = {
  label: string;
  description?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
};

type ExportReportsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  onOpen?: () => void;
  title?: string;
  description?: string;
  actions?: ExportAction[];
};

export default function ExportReportsButton({
  children = "Export / Reports",
  className = "",
  onClick,
  onOpen,
  title = "Export / reports",
  description = "Choose an export action to continue.",
  actions = [],
  ...props
}: ExportReportsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    setIsOpen(true);
    onOpen?.();
    onClick?.(event);
  };

  const handleAction = async (action: ExportAction) => {
    if (action.disabled) return;
    await action.onClick?.();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`rounded-lg border border-[#e6a100] bg-[#ffb300] px-3 py-2 text-sm font-medium text-black hover:bg-[#e6a100] ${className}`.trim()}
        onClick={handleClick}
        aria-expanded={isOpen}
        {...props}
      >
        {children}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-black">{title}</h3>
                <p className="mt-1 text-sm text-black/75">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-[#ffb300] px-2.5 py-1 text-sm font-semibold text-black hover:bg-[#e6a100]"
                aria-label="Close export options"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {actions.length > 0 ? (
                actions.map((action, index) => (
                  <button
                    key={`${action.label}-${index}`}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => void handleAction(action)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      action.disabled
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-black/50"
                        : "border-[#07713c]/25 bg-[#07713c]/[0.04] text-black hover:border-[#07713c] hover:bg-[#07713c]/10"
                    }`}
                  >
                    <p className="font-semibold">{action.label}</p>
                    {action.description ? <p className="mt-1 text-sm text-black/70">{action.description}</p> : null}
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-[#07713c]/30 bg-[#07713c]/[0.04] px-4 py-3 text-sm text-black/70">
                  No export actions are configured for this view yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mt-4 w-full rounded-lg border border-[#07713c]/30 py-2 text-sm font-medium text-black hover:bg-[#07713c]/10"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
