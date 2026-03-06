import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { CONFIG } from "../config";
import "../styles/global.css";

export default function Navbar() {
  /* Portal into #navbar-root — a sibling of #root in the HTML.
     This places the nav completely outside React's #root subtree,
     so no transform, filter, or overflow on #root or its descendants
     can ever affect position:fixed on the navbar. */
  const navbarRoot = document.getElementById("navbar-root");
  if (!navbarRoot) return null;

  return createPortal(
    <nav className="navbar">
      <span className="navbar-logo"></span>
      <ul className="navbar-links">
        {CONFIG.navLinks.map(({ label, path }) => (
          <li key={path}>
            <NavLink to={path}>{label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>,
    navbarRoot,
  );
}
