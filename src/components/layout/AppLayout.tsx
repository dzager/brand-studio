import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import TaskPanel from "@/components/layout/TaskPanel";
import { useTaskStore } from "@/lib/taskStore";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useProductTour } from "@/hooks/useProductTour";
import {
  Home,
  Building2,
  FileText,
  Search,
  Sun,
  Moon,
  Monitor,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  User,
  UserPlus,
  Palette,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import SettingsDialog from "@/components/layout/SettingsDialog";
import { useAuth } from "@/hooks/useAuth";

const ProductTour = dynamic(() => import("@/components/layout/ProductTour"), { ssr: false });

const NAV_ITEMS = [
  { href: "/articles", label: "Articles", icon: FileText, description: "Content architecture", minRole: "member" },
  { href: "/studio", label: "Studio", icon: Home, description: "Create content", minRole: "member", hidden: true, alwaysHidden: true },
  { href: "/company", label: "Company", icon: Palette, description: "Brand profile", minRole: "member", hidden: true },
  { href: "/companies", label: "Companies", icon: Building2, description: "Manage brands", minRole: "member" },
  { href: "/research", label: "Research", icon: Search, description: "Topic deep dives", minRole: "member" },
  { href: "/admin", label: "Admin", icon: Shield, description: "Platform dashboard", minRole: "admin" },
];

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface UsageSummary {
  plan: string;
  planLabel: string;
  articlesUsed: number;
  articlesLimit: number;
  percentUsed: number;
}

export default function AppLayout({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [companyCount, setCompanyCount] = useState<number | null>(null);
  const { user, activeAccount, accounts, isAdmin, signOut, switchAccount } = useAuth();
  const { tasks } = useTaskStore();
  const { startTour, resetTour } = useProductTour();

  // Fetch usage for sidebar widget
  const fetchUsage = useCallback(async () => {
    if (!activeAccount?.account_id) return;
    try {
      const r = await fetch(`/api/account/usage?account_id=${activeAccount.account_id}`);
      if (r.ok) setUsage(await r.json());
    } catch {}
  }, [activeAccount?.account_id]);

  // Sync usage on mount to correct any drift from past bugs
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!activeAccount?.account_id || synced) return;
    fetch("/api/account/sync-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: activeAccount.account_id }),
    })
      .then(() => { setSynced(true); fetchUsage(); })
      .catch(() => { setSynced(true); });
  }, [activeAccount?.account_id, synced, fetchUsage]);

  useEffect(() => {
    fetchUsage();

    // Re-fetch usage whenever an article is created anywhere in the app
    const onArticleCreated = () => fetchUsage();
    window.addEventListener("article-created", onArticleCreated);

    // Also re-fetch on route changes (catches navigations after generation)
    router.events.on("routeChangeComplete", onArticleCreated);

    return () => {
      window.removeEventListener("article-created", onArticleCreated);
      router.events.off("routeChangeComplete", onArticleCreated);
    };
  }, [fetchUsage, router.events]);

  // Fetch company count for dynamic nav label
  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => setCompanyCount(data.length))
      .catch(() => {});
  }, []);

  // Dynamic nav items: show "Company" (singular) when only 1, "Companies" when more
  const navItems = useMemo(() =>
    NAV_ITEMS.map((item) =>
      item.href === "/companies"
        ? { ...item, label: companyCount === 1 ? "Company" : "Companies" }
        : item
    ),
    [companyCount]
  );

  // Determine which nav items to show based on role
  const userRole = isAdmin ? "admin" : (activeAccount?.role || "member");
  const roleHierarchy: Record<string, number> = { member: 1, owner: 2, admin: 3 };
  const userRoleLevel = roleHierarchy[userRole] || 1;
  const isScopedMember = !isAdmin && !!activeAccount?.company_id;
  const visibleNavItems = navItems.filter(
    (item) => {
      // Permanently hidden items (e.g. Studio)
      if ((item as any).alwaysHidden) return false;
      // Role check
      if ((roleHierarchy[item.minRole] || 1) > userRoleLevel) return false;
      // Company-scoped members see /company instead of /companies
      if (isScopedMember && item.href === "/companies") return false;
      // Non-scoped members see /companies, so hide /company for them
      if (!isScopedMember && (item as any).hidden) return false;
      return true;
    }
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-56"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-center px-3 border-b border-sidebar-border">
          <a href="/index.html" className="flex items-center justify-center w-full overflow-hidden">
            <img
              src="/organic-logo.png"
              alt="Organic"
              className="dark:invert"
              style={{ height: '31px', width: 'auto' }}
            />
          </a>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-2 py-3 space-y-1" data-tour="sidebar-nav">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? router.pathname === "/"
                : router.pathname.startsWith(item.href);
            const Icon = item.icon;

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      data-tour={`nav-${item.href.replace('/', '')}`}
                      className={cn(
                        "flex h-10 w-full items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav-${item.href.replace('/', '')}`}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Usage Widget */}
        {!sidebarCollapsed && usage && (
          <div
            className="mx-2 mb-2 rounded-lg border border-border bg-background/50 p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSettingsOpen(true)}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Articles
              </span>
              <span className={cn(
                "text-[11px] font-semibold",
                usage.percentUsed >= 100 ? "text-destructive" :
                usage.percentUsed >= 80 ? "text-amber-500" : "text-foreground"
              )}>
                {usage.articlesUsed}/{usage.articlesLimit}
              </span>
            </div>
            <Progress
              value={Math.min(usage.percentUsed, 100)}
              className={cn(
                "h-1.5",
                usage.percentUsed >= 100 && "[&>[data-slot=progress-indicator]]:bg-destructive",
                usage.percentUsed >= 80 && usage.percentUsed < 100 && "[&>[data-slot=progress-indicator]]:bg-amber-500"
              )}
            />
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {/* Account switcher */}
          {accounts.length > 0 && !sidebarCollapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent transition-colors">
                  <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {(activeAccount?.account_name || "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate flex-1 text-left font-medium">
                    {activeAccount?.account_name || "No account"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.account_id}
                    onClick={() => switchAccount(acc.account_id)}
                    className={cn(
                      acc.account_id === activeAccount?.account_id && "bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {acc.account_name[0].toUpperCase()}
                      </div>
                      <span className="truncate flex-1">{acc.account_name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{acc.role}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-3 w-3 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9", sidebarCollapsed ? "mx-auto" : "")}
                onClick={() => { resetTour(); setTimeout(() => startTour(), 100); }}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Product tour</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9", sidebarCollapsed ? "mx-auto" : "")}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9", sidebarCollapsed ? "mx-auto" : "")}
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Sign out</p>
            </TooltipContent>
          </Tooltip>
          {!sidebarCollapsed && <div className="flex-1" />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9", sidebarCollapsed ? "mx-auto" : "")}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6 relative z-10">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            {/* Page title from nav */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? router.pathname === "/"
                    : router.pathname.startsWith(item.href);
                if (!isActive) return null;
                const Icon = item.icon;
                return (
                  <div key={item.href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h1 className="text-lg font-semibold tracking-tight">
                      {item.label}
                    </h1>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                      {item.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile nav links */}
            <nav className="flex md:hidden items-center gap-1">
              {visibleNavItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? router.pathname === "/"
                    : router.pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                          isActive
                            ? "bg-accent text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sign out</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-6 py-6", !fullWidth && "max-w-7xl", tasks.length > 0 && "pb-20")}>
            {children}
          </div>
        </main>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Task Activity Panel */}
      <TaskPanel />

      {/* Product Tour */}
      <ProductTour />
    </div>
  );
}
