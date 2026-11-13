import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { AppWindow, ChartColumn, Gauge, Network, Settings } from "lucide-react";
import { cx } from "./fluent";

type NavItem = { to: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: <Gauge /> },
  { to: "/usage", label: "Data usage", icon: <ChartColumn /> },
  { to: "/adapters", label: "Network adapters", icon: <Network /> },
  { to: "/widgets", label: "Widgets", icon: <AppWindow /> },
];

const SETTINGS: NavItem = { to: "/settings", label: "Settings", icon: <Settings /> };

function NavEntry({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={item.label}
      className={({ isActive }) =>
        cx(
          "relative mx-1 flex h-9 items-center gap-4 rounded-control px-3 text-body no-underline transition-colors duration-[83ms]",
          "text-fg hover:bg-subtle-hover active:bg-subtle-pressed active:text-fg-secondary",
          isActive && "bg-subtle-selected",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent"
            />
          )}
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4 [&>svg]:stroke-[1.75]"
          >
            {item.icon}
          </span>
          <span className="truncate max-[1007px]:sr-only">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Left navigation in the style of WinUI's NavigationView. Below 1008px it
 * collapses to icons only, as WinUI does.
 */
export function Sidebar() {
  return (
    <aside
      aria-label="Main navigation"
      className="flex h-full w-[280px] shrink-0 flex-col py-1 max-[1007px]:w-12"
    >
      <nav className="flex flex-1 flex-col gap-1 pt-1">
        {NAV.map((item) => (
          <NavEntry key={item.to} item={item} />
        ))}
      </nav>
      <div className="flex flex-col pb-1">
        <NavEntry item={SETTINGS} />
      </div>
    </aside>
  );
}
