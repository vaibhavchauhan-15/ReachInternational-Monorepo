"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatedSearch,
  AnimatedDashboard,
  AnimatedWrench,
  AnimatedClipboardList,
  AnimatedBell,
  AnimatedUsers,
  AnimatedFileText,
  AnimatedSettings,
  AnimatedPlus,
  AnimatedArrowRight,
  AnimatedSparkles,
  AnimatedPackage,
  AnimatedBuilding2,
  AnimatedGauge,
} from "./animated-icons";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Quick Actions" | "System";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  action?: () => void;
  shortcut?: string;
  /** Alternate search terms (synonyms/aliases) so keyword search matches intent. */
  keywords?: string[];
  /** Roles allowed to see this command. Omit = visible to every role. */
  roles?: string[];
}

export function CommandPalette({
  isOpen,
  onClose,
  userRole = "admin",
}: {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        subtitle: "View machine overview and key analytics",
        category: "Navigation",
        icon: AnimatedDashboard,
        href: "/dashboard",
        shortcut: "⌘D",
        keywords: ["home", "overview", "stats", "kpi", "metrics", "analytics", "summary"],
      },
      {
        id: "nav-machines",
        title: "Go to Machines Directory",
        subtitle: "Browse and manage tracked equipment fleet",
        category: "Navigation",
        icon: AnimatedWrench,
        href: "/machines",
        shortcut: "⌘M",
        keywords: ["equipment", "devices", "inventory", "assets", "machine list"],
        roles: ["super_admin", "admin", "branch_manager", "service_engineer", "supervisor", "operator", "mechanic", "sales_executive", "rental_manager"],
      },
      {
        id: "nav-operations",
        title: "Go to Operations & Meter Logs",
        subtitle: "View daily running hour logs and operator assignments",
        category: "Navigation",
        icon: AnimatedGauge,
        href: "/operations",
        keywords: ["running hours", "meter log", "duty", "operator assignment", "work logs"],
        roles: ["super_admin", "admin", "branch_manager", "supervisor", "operator", "mechanic"],
      },
      {
        id: "nav-inventory",
        title: "Go to Inventory & Stock Ledger",
        subtitle: "Manage spare parts stock ledger and inter-branch transfers",
        category: "Navigation",
        icon: AnimatedPackage,
        href: "/inventory",
        shortcut: "⌘I",
        keywords: ["stock", "spare parts", "transfer", "warehouse", "ledger", "parts issue"],
        roles: ["super_admin", "admin", "branch_manager", "store_manager", "service_engineer", "mechanic", "finance_manager"],
      },
      {
        id: "nav-hr",
        title: "Go to HR & Staff Directory",
        subtitle: "Manage employee profiles, designations, and payroll",
        category: "Navigation",
        icon: AnimatedUsers,
        href: "/hr",
        keywords: ["employees", "staff", "onboarding", "hr", "payroll", "designation", "salary"],
        roles: ["super_admin", "admin", "hr_manager", "branch_manager", "finance_manager"],
      },
      {
        id: "nav-branches",
        title: "Go to Branch Directory",
        subtitle: "View company branches and multi-location fleet overview",
        category: "Navigation",
        icon: AnimatedBuilding2,
        href: "/branches",
        keywords: ["locations", "offices", "delhi", "gurgaon", "branches", "sites"],
        roles: ["super_admin", "admin", "branch_manager"],
      },
      {
        id: "nav-services",
        title: "Go to Service Logs",
        subtitle: "View service schedules and maintenance history",
        category: "Navigation",
        icon: AnimatedClipboardList,
        href: "/machines?tab=services",
        shortcut: "⌘S",
        keywords: ["work orders", "tasks", "schedule", "maintenance", "jobs", "assignments"],
      },
      {
        id: "nav-notifications",
        title: "Go to Notifications",
        subtitle: "View service alerts and automated reminders",
        category: "Navigation",
        icon: AnimatedBell,
        href: "/notifications",
        shortcut: "⌘N",
        keywords: ["alerts", "reminders", "emails", "messages", "inbox"],
        roles: ["super_admin", "admin", "branch_manager", "service_engineer"],
      },
      {
        id: "nav-users",
        title: "Go to User Accounts",
        subtitle: "Manage platform login accounts and permissions",
        category: "Navigation",
        icon: AnimatedUsers,
        href: "/users",
        shortcut: "⌘U",
        keywords: ["team", "staff", "engineers", "admins", "people", "accounts", "roles"],
        roles: ["super_admin", "admin"],
      },
      {
        id: "nav-audit",
        title: "Audit Security Logs",
        subtitle: "Inspect system security events and activity audit trail",
        category: "Navigation",
        icon: AnimatedFileText,
        href: "/audit-logs",
        keywords: ["logs", "history", "activity", "security", "events", "tracking", "records"],
        roles: ["super_admin", "admin"],
      },
      {
        id: "nav-settings",
        title: "System Settings",
        subtitle: "Configure platform defaults, roles, and integrations",
        category: "Navigation",
        icon: AnimatedSettings,
        href: "/settings",
        keywords: ["config", "configuration", "preferences", "setup", "email", "sms"],
        roles: ["super_admin"],
      },
      {
        id: "action-add-machine",
        title: "Create New Machine",
        subtitle: "Register a new machine into REACH INTERNATIONAL fleet",
        category: "Quick Actions",
        icon: AnimatedPlus,
        href: "/machines?action=create",
        keywords: ["add equipment", "new device", "register", "add asset"],
        roles: ["super_admin", "admin", "branch_manager"],
      },
      {
        id: "action-add-user",
        title: "Invite New User",
        subtitle: "Create engineer or admin user accounts",
        category: "Quick Actions",
        icon: AnimatedPlus,
        href: "/users?action=create",
        keywords: ["add engineer", "invite", "create account", "new staff"],
        roles: ["super_admin", "admin"],
      },
    ];

    return items.filter(item => !item.roles || item.roles.includes(userRole));
  }, [userRole]);

  const filteredItems = useMemo(() => {
    const raw = search.trim().toLowerCase();
    if (!raw) return commandItems;
    const tokens = raw.split(/\s+/).filter(Boolean);

    // Score each item so the strongest keyword matches surface first & fast.
    const scored = commandItems
      .map((item) => {
        const title = item.title.toLowerCase();
        const subtitle = (item.subtitle || "").toLowerCase();
        const keywords = (item.keywords || []).join(" ").toLowerCase();
        const haystack = `${title} ${subtitle} ${item.category.toLowerCase()} ${keywords}`;

        let score = 0;
        for (const token of tokens) {
          if (!haystack.includes(token)) return null; // every token must match somewhere
          if (title.startsWith(token)) score += 100;
          else if (title.includes(` ${token}`)) score += 60; // word-boundary hit in title
          else if (title.includes(token)) score += 40;
          else if (keywords.includes(token)) score += 25;
          else if (subtitle.includes(token)) score += 10;
          else score += 5;
        }
        // Whole-query exact prefix on the title is the strongest signal.
        if (title.startsWith(raw)) score += 200;
        return { item, score };
      })
      .filter((entry): entry is { item: CommandItem; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score);

    return scored.map((entry) => entry.item);
  }, [commandItems, search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setSelectedIndex(0);
  };

  const executeItem = useCallback(
    (item: CommandItem) => {
      onClose();
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filteredItems, selectedIndex, executeItem]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-50 w-full max-w-xl bg-card border border-border rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card group">
              <AnimatedSearch size={20} className="text-muted-foreground group-focus-within:text-foreground transition-colors flex-shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={handleSearchChange}
                placeholder="Type a command or search..."
                className="w-full bg-transparent text-sm body-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Command Results */}
            <div className="overflow-y-auto p-2 space-y-1 max-h-96 bg-card">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <AnimatedSparkles size={24} className="text-muted-foreground opacity-50" />
                  No commands or pages found for &ldquo;{search}&rdquo;
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all ${
                        isSelected
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-semibold text-foreground group-hover:text-foreground transition-colors">
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="text-[11px] text-muted-foreground group-hover:text-foreground/80 truncate transition-colors">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <AnimatedArrowRight
                          size={14}
                          trigger="parent-hover"
                          className={`transition-all ${
                            isSelected ? "text-foreground opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center justify-end text-[11px] text-muted-foreground">
              <span>REACH INTERNATIONAL Quick Actions</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
