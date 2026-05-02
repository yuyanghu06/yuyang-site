import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { CONFIG } from "../config";
import { useMobileDevice } from "../hooks/useMobileDevice";
import "../styles/global.css";

export default function Navbar() {
  const navbarRoot = document.getElementById("navbar-root");
  const { isMobile } = useMobileDevice();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isOpen]);

  if (!navbarRoot) return null;

  return createPortal(
    <nav className="navbar">
      <div className="navbar-left">
        <a href="/admin/ingest" className="navbar-admin-link">Admin</a>
      </div>

      <span className="navbar-logo"></span>

      {isMobile ? (
        <>
          <button
            className="navbar-hamburger"
            onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
          >
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
            <span className={`hamburger-line${isOpen ? " hamburger-line--open" : ""}`} />
          </button>

          {isOpen && (
            <div
              className="navbar-backdrop"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
          )}

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
                  <NavLink to={path} onClick={() => setIsOpen(false)}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
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
