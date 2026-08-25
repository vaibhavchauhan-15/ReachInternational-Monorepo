"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  AnimatedArrowRight,
  AnimatedX,
  AnimatedChevronRight,
  AnimatedChevronDown,
  AnimatedSearch,
  AnimatedDashboard,
  AnimatedWrench,
  AnimatedBell,
  AnimatedUsers,
  AnimatedFileText,
  AnimatedSettings,
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
  AnimatedPhone,
  AnimatedMenu,
  AnimatedLogOut,
} from "@/components/ui/animated-icons";

import { motion, AnimatePresence } from "framer-motion";
import type { User, UserRole } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo, ReachInternationalLogo, BRAND_ASSETS } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

export interface PublicNavbarProps {
  user?: User | null;
  isLoggedIn?: boolean;
  navLinks?: NavItem[];
  brandTitle?: string;
  brandHref?: string;
  logoSrc?: string;
  showAuthButtons?: boolean;
  showSearch?: boolean;
}

export const defaultPublicNavLinks: NavItem[] = [
  { label: "Equipment", href: "#equipment" },
  { label: "Workflow", href: "#workflow" },
  { label: "Features", href: "#features" },
  { label: "Analytics", href: "#analytics" },
  { label: "Reminders", href: "#reminders" },
  { label: "Mobile App", href: "#mobile" },
  { label: "Security", href: "#security" },
  { label: "Reviews", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export const appNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: AnimatedDashboard },
  { href: "/machines", label: "Machines", icon: AnimatedWrench },
  { href: "/notifications", label: "Notifications", icon: AnimatedBell, roles: ["super_admin", "admin", "service_engineer", "engineer"] },
  { href: "/users", label: "Users", icon: AnimatedUsers, roles: ["super_admin", "admin", "hr_manager"] },
  { href: "/audit-logs", label: "Audit Logs", icon: AnimatedFileText, roles: ["super_admin", "admin"] },
  { href: "/settings", label: "Settings", icon: AnimatedSettings, roles: ["super_admin"] },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  service_manager: "Service Manager",
  engineer: "Service Engineer",
  service_engineer: "Service Engineer",
  supervisor: "Supervisor",
  store_manager: "Store Manager",
  operator: "Operator",
  mechanic: "Mechanic",
  hr_manager: "HR Manager",
  finance_manager: "Finance Manager",
  sales_executive: "Sales Executive",
  rental_manager: "Rental Manager",
};

const UserMenu = memo(function UserMenu({ user }: { user: User }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-full hover:bg-[var(--color-hairline-soft-surface)] transition-colors duration-150 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-bold shadow-xs">
          {user.full_name.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-[var(--color-ink)] hidden sm:inline">{user.full_name}</span>
        <AnimatedChevronDown size={14} className={`text-[var(--color-mute)] transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-2xl text-[var(--color-ink)] backdrop-blur-md"
            >
              {/* Header Profile Box */}
              <div className="p-3 border border-[var(--color-hairline)] bg-[var(--color-canvas)] rounded-[var(--radius-md)] mb-2.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold text-sm shadow-md ring-2 ring-primary/20">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--color-ink)] truncate leading-tight">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-[var(--color-mute)] truncate font-medium mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Metadata Pills Row: Role & Status */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-hairline)]">
                  {/* Role Pill */}
                  {user.role === "super_admin" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300/80 dark:border-red-800/80 shadow-xs">
                      <AnimatedShieldAlert size={12} className="text-red-600 dark:text-red-400" />
                      Super Admin
                    </span>
                  )}
                  {user.role === "admin" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-xs">
                      <AnimatedShieldCheck size={12} className="text-amber-600 dark:text-amber-400" />
                      Admin
                    </span>
                  )}
                  {user.role === "engineer" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800/80 shadow-xs">
                      <AnimatedShield size={12} className="text-blue-600 dark:text-blue-400" />
                      Engineer
                    </span>
                  )}

                  {/* Status Pill */}
                  {user.status === "active" || !user.status ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {user.status}
                    </span>
                  )}
                </div>

                {/* Phone row if present */}
                {user.phone && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)] font-medium pt-1">
                    <AnimatedPhone size={12} className="text-[var(--color-link)] shrink-0" />
                    <span className="truncate">{user.phone}</span>
                  </div>
                )}
              </div>

              {/* Navigation Links in Tab */}
              {(user.role === "admin" || user.role === "super_admin") && (
                <div className="space-y-0.5 py-0.5">
                  <Link
                    href="/users"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                  >
                    <AnimatedUsers size={16} className="text-amber-500" />
                    User Management
                  </Link>
                  <Link
                    href="/audit-logs"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                  >
                    <AnimatedFileText size={16} className="text-purple-500" />
                    Audit Security Logs
                  </Link>
                </div>
              )}

              <div className="my-1.5 border-t border-[var(--color-hairline)]" />

              {/* Sign out */}
              <form action={logout}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-[var(--radius-sm)] text-xs font-semibold text-[var(--color-ink)] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  <AnimatedLogOut size={16} className="text-rose-500" />
                  Sign Out
                </motion.button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

export function PublicNavbar({
  user = null,
  isLoggedIn = false,
  navLinks,
  brandTitle = "REACH INTERNATIONAL",
  brandHref,
  logoSrc = BRAND_ASSETS.lightLogo,
  showAuthButtons = true,
  showSearch,
}: PublicNavbarProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const effectiveIsLoggedIn = Boolean(user || isLoggedIn);
  const effectiveBrandHref = brandHref || (user ? "/dashboard" : "/");
  const effectiveShowSearch = showSearch !== undefined ? showSearch : Boolean(user);

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Detect platform for the correct command-palette shortcut glyph (⌘K vs Ctrl K).
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // Determine active nav links
  const activeNavItems = useMemo(() => {
    if (navLinks) return navLinks;
    if (user) {
      return appNavItems.filter((item) => !item.roles || item.roles.includes(user.role));
    }
    return defaultPublicNavLinks;
  }, [navLinks, user]);

  // Scroll listener for sticky background & ScrollSpy
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      if (isHomePage) {
        const sectionIds = activeNavItems
          .map((link) => link.href)
          .filter((href) => href.startsWith("#"))
          .map((href) => href.replace("#", ""));

        let currentSection = "";
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= 200 && rect.bottom >= 150) {
              currentSection = `#${id}`;
              break;
            }
          }
        }
        setActiveSection(currentSection);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage, activeNavItems]);

  // Global ⌘K listener
  useEffect(() => {
    if (!effectiveShowSearch) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveShowSearch]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    const isHashLink = href.startsWith("#");

    if (isHomePage && isHashLink) {
      e.preventDefault();
      setActiveSection(href);
      setMobileMenuOpen(false);

      const targetElement = document.querySelector(href);
      if (targetElement) {
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    } else {
      setMobileMenuOpen(false);
    }
  };

  const getFullHref = (href: string) => {
    if (href.startsWith("#")) {
      return isHomePage ? href : `/${href}`;
    }
    return href;
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          user ? "hidden md:block " : ""
        }${
          scrolled
            ? "bg-card/85 backdrop-blur-md border-b border-border shadow-md py-3"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between gap-4">
            {/* Brand Logo */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Link
                href={effectiveBrandHref}
                className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-1 px-0 flex-shrink-0 select-none"
              >
                <ReachInternationalLogo variant="full" size={24} />
              </Link>
            </motion.div>

            {/* Desktop Navigation Links */}
            {activeNavItems.length > 0 && (
              <nav
                onMouseLeave={() => setHoveredLink(null)}
                className="hidden md:flex items-center gap-0.5 xl:gap-1 bg-card/70 p-1 xl:p-1.5 rounded-full border border-border backdrop-blur-sm shadow-xs relative"
              >
                {activeNavItems.map((link) => {
                  const fullHref = getFullHref(link.href);
                  const Icon = link.icon;
                  const isActive = isHomePage
                    ? activeSection === link.href
                    : pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));

                  return (
                    <motion.div
                      key={link.label}
                      whileTap={{ scale: 0.98 }}
                      onMouseEnter={() => setHoveredLink(link.href)}
                      className="relative"
                    >
                      <Link
                        href={fullHref}
                        onClick={(e) => handleNavClick(e, link.href)}
                        className={`relative px-2 xl:px-3 py-1.5 text-xs font-medium transition-colors duration-150 rounded-full select-none flex items-center gap-1.5 whitespace-nowrap ${
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {/* Sliding hover pill (soft) */}
                        {hoveredLink === link.href && !isActive && (
                          <motion.div
                            layoutId="public-navbar-hover-pill"
                            transition={{ type: "spring", stiffness: 500, damping: 34 }}
                            className="absolute inset-0 bg-muted/70 rounded-full"
                          />
                        )}
                        {/* Active pill background with Framer Motion spring sliding */}
                        {isActive && (
                          <motion.div
                            layoutId="public-navbar-active-pill"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                            className="absolute inset-0 bg-muted rounded-full border border-border shadow-2xs"
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            )}

            {/* Right Action Items */}
            <div className="flex items-center gap-2.5">
              {/* Theme Toggle Button */}
              <ThemeToggle />

              {/* Quick Search Button if logged in / enabled */}
              {effectiveShowSearch && user && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setCmdOpen(true)}
                  className="group flex items-center gap-2 px-3.5 py-1.5 w-36 sm:w-48 rounded-full bg-muted/60 border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted hover:border-muted-foreground/50 transition-all select-none shadow-2xs cursor-pointer"
                  title={`Open Command Palette (${isMac ? "⌘K" : "Ctrl K"})`}
                >
                  <AnimatedSearch size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="font-medium truncate text-xs">Search...</span>
                  <kbd className="ml-auto hidden sm:flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {isMac ? "⌘" : "Ctrl"}
                    <span>K</span>
                  </kbd>
                </motion.button>
              )}

              {/* User Avatar Menu if logged in */}
              {user ? (
                <UserMenu user={user} />
              ) : showAuthButtons ? (
                <div className="hidden sm:flex items-center gap-3">
                  {effectiveIsLoggedIn ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                      <Link
                        href="/dashboard"
                        className="btn-primary flex items-center gap-2 text-xs h-9 px-4 font-medium transition-all shadow-xs hover:shadow-md"
                      >
                        Go to Dashboard
                        <AnimatedArrowRight size={14} />
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                      <Link
                        href="/login"
                        className="relative group overflow-hidden rounded-full bg-primary text-primary-foreground text-xs font-medium px-4.5 py-2 flex items-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md hover:opacity-95"
                      >
                        <span className="relative z-10 flex items-center gap-1.5">
                          Get Started
                          <AnimatedChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </Link>
                    </motion.div>
                  )}
                </div>
              ) : null}

              {/* Mobile Menu Button */}
              {activeNavItems.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-foreground hover:bg-muted focus:outline-none transition-colors"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? (
                    <AnimatedX size={24} />
                  ) : (
                    <AnimatedMenu size={24} />
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="md:hidden bg-card border-b border-border px-4 pt-3 pb-6 space-y-3 shadow-lg"
            >
              <div className="flex flex-col space-y-1">
                {activeNavItems.map((link) => {
                  const fullHref = getFullHref(link.href);
                  const Icon = link.icon;
                  const isActive = isHomePage
                    ? activeSection === link.href
                    : pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));

                  return (
                    <motion.div key={link.label} whileTap={{ scale: 0.98 }}>
                      <Link
                        href={fullHref}
                        onClick={(e) => handleNavClick(e, link.href)}
                        className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-between ${
                          isActive
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              {!user && showAuthButtons && (
                <div className="pt-3 border-t border-border flex flex-col gap-2">
                  {effectiveIsLoggedIn ? (
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="btn-primary w-full justify-center text-xs"
                    >
                      Go to Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="btn-primary w-full justify-center text-xs"
                    >
                      Get Started
                    </Link>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Command Palette Modal for Logged-In App Mode */}
      {user && (
        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          userRole={user.role}
        />
      )}
    </>
  );
}
