import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, User } from "lucide-react";
import { useState, useMemo } from "react";
import { tokenManager } from "../lib/api";
import BottomNav from "./BottomNav";

interface LayoutProps {
  children: React.ReactNode;
}

interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isStaging = window.location.hostname.includes('staging') || import.meta.env.VITE_ENVIRONMENT === 'staging';
  
  const isAuthenticated = !!tokenManager.getToken();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    tokenManager.removeToken();
    navigate('/login');
  };

  const userRole = useMemo(() => {
    const token = tokenManager.getToken();
    if (!token) return 'user';
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as TokenPayload;
      return payload.role || 'user';
    } catch {
      return 'user';
    }
  }, [isAuthenticated]);

  const isAdmin = userRole === 'admin';

  const navLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Packages", path: "/packages" },
    { label: "P2P", path: "/p2p" },
    { label: "My Wallet", path: "/wallet" },
    { label: "Referral", path: "/referral" },
    { label: "Customer Support", path: "/customer-support" },
    ...(isAdmin ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Staging Badge */}
      {isStaging && (
        <div className="bg-yellow-900 text-yellow-100 text-xs font-bold text-center py-2 px-4">
          🧪 STAGING ENVIRONMENT - For Testing Only
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#1E2329]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src="/globance-icon.svg" 
                alt="Globance" 
                className="h-9 w-9 object-contain group-hover:opacity-80 transition-opacity"
              />
              <span className="hidden sm:inline font-bold text-lg text-foreground">
                Globance
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive(link.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-md transition-colors text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 flex items-center gap-2 ml-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-2 md:gap-4">
              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                  >
                    <User size={20} />
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:inline-block px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Register
                  </Link>
                </>
              )}

              {/* Mobile Menu Button - Only for admin users */}
              {isAdmin && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Navigation - Only for admin */}
          {mobileMenuOpen && isAdmin && (
            <nav className="md:hidden pb-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive(link.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="block w-full text-left px-4 py-2 rounded-md transition-colors text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 border-t border-border mt-2 pt-4"
                >
                  <div className="flex items-center gap-2">
                    <LogOut size={16} />
                    Logout
                  </div>
                </button>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${isAuthenticated && !isAdmin ? 'pb-20 md:pb-0' : ''}`}>
        {children}
      </main>

      {/* Bottom Navigation - Only for authenticated non-admin users */}
      {isAuthenticated && !isAdmin && <BottomNav />}

      {/* Footer - Hidden on mobile for authenticated users */}
      <footer className={`border-t border-white/5 bg-[#1E2329] mt-20 ${isAuthenticated && !isAdmin ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img 
                  src="/globance-icon.svg" 
                  alt="Globance" 
                  className="h-8 w-8 object-contain"
                />
                <span className="font-bold text-lg">Globance</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Activate mining power. Earn daily.
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Cloud mining made simple, powerful, and reliable.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Product</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <Link to="/packages" className="hover:text-foreground transition">
                    Investment Plans
                  </Link>
                </li>
                <li>
                  <Link to="/p2p" className="hover:text-foreground transition">
                    P2P Marketplace
                  </Link>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Support</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8">
            <p className="text-center text-muted-foreground text-sm">
              © 2024 Globance. All rights reserved. | Professional Cloud Mining Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
