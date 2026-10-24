"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Icon, { type IconName } from "./Icon";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "overview" },
      { href: "/executive", label: "Executive", icon: "executive" },
      { href: "/products", label: "Products", icon: "products" },
      { href: "/reviews", label: "Reviews", icon: "reviews" },
      { href: "/sentiment", label: "Sentiment", icon: "sentiment" },
    ],
  },
  {
    label: "AI & Intelligence",
    items: [
      { href: "/evals", label: "Model Evaluation", icon: "evals" },
      { href: "/insights", label: "Insights", icon: "insights" },
      { href: "/review", label: "Human Review", icon: "review" },
    ],
  },
  {
    label: "Interactive Demo",
    items: [
      {
        href: "/demo",
        label: "Try Senvu",
        icon: "insights",
        badge: "NEW",
      },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    document.body.classList.remove("nav-open");
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document.body.classList.remove("nav-open");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <aside
        className="sidebar"
        id="primary-nav"
        aria-label="Primary navigation"
      >
        <Link
          className="brand-block"
          href="/dashboard"
          aria-label="Senvu home"
        >
          <img
            className="brand-logo"
            src="/senvu-logo.png"
            alt="Senvu"
          />
          <div className="brand-tagline">
            Customer Intelligence &amp; AI Evals
          </div>
        </Link>

        <div className="workspace-badge">
          <span className="ws-avatar">NE</span>
          <span>Nova Electronics</span>
          <span className="ws-caret">
            <Icon name="chevrons" size={14} />
          </span>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            <nav className="side-nav">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="nav-icon">
                      <Icon name={item.icon} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="connection-card">
            <div className="connection-row">
              <span className="status-dot" /> Data connected
            </div>
            <div className="connection-meta">
              Supabase · Live workspace
            </div>
          </div>
        </div>
      </aside>

      <div
        className="nav-scrim"
        onClick={() => document.body.classList.remove("nav-open")}
        aria-hidden="true"
      />
    </>
  );
}
