import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: <IconDashboard /> },
  { to: "/history", label: "History", icon: <IconHistory /> },
  { to: "/interfaces", label: "Interfaces", icon: <IconWifi /> },
  { to: "/widgets", label: "Widgets", icon: <IconWidgets /> },
];

export function Sidebar() {
  return (
    <aside
      className="w-50 min-w-50 shrink-0 bg-panel border-r border-border flex flex-col h-screen"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-center px-4 pt-4 pb-3.5 border-b border-border">
        <img
          className="w-full max-w-40 h-auto block in-data-[theme='dark']:hidden"
          src="/branding/logo-horizontal-dark.png"
          alt="FluxNet"
        />
        <img
          className="w-full max-w-40 h-auto hidden in-data-[theme='dark']:block"
          src="/branding/logo-horizontal-light.png"
          alt="FluxNet"
        />
      </div>

      <nav className="flex-1 px-2 py-2.5 flex flex-col gap-px overflow-y-auto scrollbar-none">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] no-underline transition-colors duration-150 cursor-pointer font-[450] ${
                isActive
                  ? "bg-accent-soft text-sidebar-active font-[550]"
                  : "text-text-subtle hover:bg-accent-soft-2 hover:text-sidebar-active"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`}
                >
                  {item.icon}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pb-4 pt-2.5 border-t border-border">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] no-underline transition-colors duration-150 cursor-pointer font-[450] ${
              isActive
                ? "bg-accent-soft text-sidebar-active font-[550]"
                : "text-text-subtle hover:bg-accent-soft-2 hover:text-sidebar-active"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`}
              >
                <IconSettings />
              </span>
              Settings
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}

function IconDashboard() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconWifi() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconWidgets() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </svg>
  );
}
