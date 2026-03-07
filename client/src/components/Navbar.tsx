import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { CONFIG } from "../config";
import { useMobileDevice } from "../hooks/useMobileDevice";
import "../styles/global.css";

export default function Navbar() {
  /* Portal into #navbar-root — a sibling of #root in the HTML.
     This places the nav completely outside React's #root subtree,
     so no transform, filter, or overflow on #root or its descendants
     can ever affect position:fixed on the navbar. */
  const navbarRoot = document.getElementById("navbar-root");

  /* Detect mobile device via user-agent cookie */
  const { isMobile } = useMobileDevice();

  /* Drawer open/close state for mobile hamburger menu */
  const [isOpen, setIsOpen] = useState(false);

  /* Current route — used to auto-close the drawer on navigation */
  const location = useLocation();

  /* Ref for click-outside detection to close the drawer */
  const drawerRef = useRef<HTMLDivElement>(null);

  /* Close the drawer whenever the user navigates to a new route */
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  /* Close drawer when clicking outside the drawer panel */
  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  if (!navbarRoot) return null;

  return createPortal(
    <nav className="navbar">
      {/* Brand mark — left side on all breakpoints */}
      <span className="navbar-logo"></span>

      {isMobile ? (
        /* ── Mobile layout: hamburger button + slide-in drawer ── */
        <>
          {/* Three-line hamburger button — animates to × when drawer is open */}
          <button
            className="navbar-hamburger"
            onClick={() => setIsOpen((v) => !v)}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
          >
            {/* Each line transitions independently to form an × */}
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
          </button>

          {/* Dark backdrop — closes drawer on tap */}
          {isOpen && (
            <div
              className="navbar-backdrop"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Slide-in drawer panel — enters from the right edge */}
          <div
            ref={drawerRef}
            className={`navbar-drawer${isOpen ? " navbar-drawer--open" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <ul className="navbar-drawer-links">
              {CONFIG.navLinks.map(({ label, path }) => (
                <li key={path}>
                  {/* Clicking a link also closes the drawer */}
                  <NavLink to={path} onClick={() => setIsOpen(false)}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        /* ── Desktop layout: inline horizontal link row ── */
        <ul className="navbar-links">
          {CONFIG.navLinks.map(({ label, path }) => (
            <li key={path}>
              <NavLink to={path}>{label}</NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>,
    navbarRoot,
  );
}
