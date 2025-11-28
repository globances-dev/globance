import { Link, useLocation } from "react-router-dom";
import { Home, Cpu, ArrowLeftRight, Wallet, User } from "lucide-react";

const navItems = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/mining", icon: Cpu, label: "Mining" },
  { path: "/p2p", icon: ArrowLeftRight, label: "P2P" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1E2329] border-t border-white/5 z-50 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? "text-[#F0B90B]"
                  : "text-[#6F7680] hover:text-white"
              }`}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
