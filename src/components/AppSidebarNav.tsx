import { useEffect, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import type { AppNavItem } from "../utils/appNav";

type AppSidebarNavProps = {
  items: AppNavItem[];
  activeNavId: string;
  onNavigate?: (navId: string) => void;
  /** Extra classes on the <nav> element (e.g. Events mobile spacing). */
  className?: string;
  /** Extra classes on each leaf button (e.g. Events mobile sizing). */
  itemClassName?: string;
};

function isChildActive(item: AppNavItem, activeNavId: string): boolean {
  return Boolean(item.children?.some((c) => c.id === activeNavId));
}

export default function AppSidebarNav({
  items,
  activeNavId,
  onNavigate,
  className = "flex-1 space-y-1 px-4 pb-4",
  itemClassName = "",
}: AppSidebarNavProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (item.children?.length && isChildActive(item, activeNavId)) {
          next[item.id] = true;
        }
      }
      return next;
    });
  }, [items, activeNavId]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const leafButtonClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${itemClassName} ${
      active ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
    }`;

  return (
    <nav className={className}>
      {items.map((item) => {
        if (item.children?.length) {
          const expanded = openGroups[item.id] ?? isChildActive(item, activeNavId);
          const groupActive = isChildActive(item, activeNavId);
          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(item.id)}
                aria-expanded={expanded}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${itemClassName} ${
                  groupActive ? "bg-white/10 text-white" : "text-green-100 hover:bg-white/15"
                }`}
              >
                <SidebarNavIcon navId={item.id} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <svg
                  className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {expanded && (
                <div className="ml-3 space-y-1 border-l border-white/20 pl-2">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onNavigate?.(child.id)}
                      className={leafButtonClass(activeNavId === child.id)}
                    >
                      <SidebarNavIcon navId={child.id} />
                      <span className="truncate">{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate?.(item.id)}
            className={leafButtonClass(activeNavId === item.id)}
          >
            <SidebarNavIcon navId={item.id} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
