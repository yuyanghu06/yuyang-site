import { NavLink } from "react-router-dom";
import { CONFIG } from "../config";
import "../styles/global.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar-logo"></span>
      <ul className="navbar-links">
        {CONFIG.navLinks.map(({ label, path }) => (
          <li key={path}>
            <NavLink to={path}>{label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
