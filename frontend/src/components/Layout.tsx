import Navbar from "./Navbar";

export default function Layout({ children, footer }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-zinc-500">
        {footer ?? null}
      </footer>
    </div>
  );
}