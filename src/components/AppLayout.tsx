import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, LayoutDashboard, Menu, X, Settings, Package } from 'lucide-react';
import UserProfile from '@/components/UserProfile';
import { useActivityTracker } from '@/hooks/useActivityTracker';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Propostas', path: '/propostas', icon: FileText },
  { label: 'Clientes', path: '/clientes', icon: Users },
  { label: 'Catálogo', path: '/catalogo', icon: Package },
  { label: 'Configurações', path: '/configuracoes', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Regista actividade do utilizador em cada página
  useActivityTracker();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Proposta<span className="text-primary">Já</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-2 pl-2 border-l border-border flex items-center gap-2">
              <UserProfile />
            </div>
          </nav>

          {/* Mobile profile + toggle */}
          <div className="md:hidden flex items-center gap-2">
            <UserProfile compact />
            <button
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Abrir menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border p-3 space-y-1 animate-fade-in">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 mt-2 border-t border-border">
              <UserProfile />
            </div>
          </nav>
        )}
      </header>

      <main className="container py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
