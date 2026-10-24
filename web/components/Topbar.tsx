"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Topbar() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));

    // "/" or Cmd/Ctrl+K focuses search from anywhere (except while typing).
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("senvu-theme", next); } catch { /* storage unavailable */ }
    setTheme(next);
  }

  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        type="button"
        aria-label="Open navigation"
        aria-controls="primary-nav"
        onClick={() => document.body.classList.toggle("nav-open")}
      >
        <Icon name="menu" />
      </button>

      <form className="global-search" action="/reviews" method="get" role="search">
        <span className="search-icon"><Icon name="search" size={16} /></span>
        <input ref={searchRef} name="q" aria-label="Search customer feedback" placeholder="Search reviews, products, themes…" autoComplete="off" />
        <kbd className="search-shortcut">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </form>

      <div className="topbar-actions">
        <div className="data-status"><span className="status-dot" /> Live</div>
        <Link className="topbar-link" href="/executive">Executive view</Link>
        <button
          className="icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title="Toggle theme"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>
        <div className="user-menu">
          <div className="avatar">SW</div>
          <div className="user-copy"><strong>Senvu workspace</strong><span>Analyst access</span></div>
        </div>
      </div>
    </header>
  );
}
