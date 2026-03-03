import { NavLink } from "react-router-dom";

function NavTab({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "text-sm px-3 py-2 rounded-md transition-colors",
          isActive ? "bg-zinc-100 text-black" : "text-zinc-600 hover:text-black hover:bg-zinc-100",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function Navbar() {
  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="text-lg font-semibold tracking-tight">ManuVision</div>
        <nav className="flex gap-2">
          <NavTab to="/translate" label="Translate" />
          <NavTab to="/practice" label="Practice" />
        </nav>
      </div>
    </header>
  );
}