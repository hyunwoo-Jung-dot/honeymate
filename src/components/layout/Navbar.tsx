"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  Ticket,
  BarChart3,
  LogIn,
  LogOut,
  Menu,
  Shield,
  Package,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "대시보드", icon: BarChart3 },
  { href: "/members", label: "길드원", icon: Users },
  { href: "/events", label: "참석관리", icon: Calendar },
  { href: "/lottery", label: "뽑기", icon: Ticket },
  { href: "/party", label: "파티편성", icon: UsersRound },
  { href: "/items", label: "아이템", icon: Package },
  { href: "/stats", label: "통계", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAdmin, signOut, loading } = useAuth();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Link
          href="/"
          className="mr-6 flex items-center gap-2 font-bold"
        >
          <Shield className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">꿀메이트</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <Badge variant="outline" className="text-xs">
              운영진
            </Badge>
          )}
          {!loading &&
            (isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4 mr-1" />
                로그아웃
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  <LogIn className="h-4 w-4 mr-1" />
                  운영진 로그인
                </Button>
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
