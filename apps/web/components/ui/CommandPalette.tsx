"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatedSearch,
  AnimatedDashboard,
  AnimatedClock,
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
        id: "nav-machines",
        title: "Go to Machines Directory",
        subtitle: "Browse and manage tracked equipment fleet (add, edit, delete)",
        category: "Navigation",
        icon: AnimatedWrench,
        href: "/machines",
        shortcut: "⌘M",
        keywords: ["equipment", "devices", "inventory", "assets", "machine list"],
        roles: ["super_admin", "admin", "service_manager", "supervisor", "operator"],
      },
      {
        id: "nav-operations-entry",
        title: "Daily Log Entry",
        subtitle: "Submit daily machine running hour log entries",
        category: "Navigation",
        icon: AnimatedGauge,
        href: "/operations?tab=entry",
        keywords: ["running hours", "meter log", "log entry", "duty", "work log"],
        roles: ["operator"],
      },
      {
        id: "nav-operations-history",
        title: "Log History & Export",
        subtitle: "View past machine logs and export printable PDF reports",
        category: "Navigation",
        icon: AnimatedClock,
        href: "/operations?tab=history",
        keywords: ["log history", "reports", "export pdf", "print logbook"],
        roles: ["operator"],
      },
      {
        id: "nav-operations-running-hours",
        title: "Running Hours & Assignments",
        subtitle: "View daily machine running hour logs and operator assignments",
        category: "Navigation",
        icon: AnimatedClipboardList,
        href: "/operations?tab=logs",
        keywords: ["running hours", "meter log", "log history", "operations", "assignments"],
        roles: ["super_admin", "admin", "supervisor", "service_manager"],
      },
      {
        id: "nav-users",
        title: "Go to Employee & User Management",
        subtitle: "Manage employee accounts, staff roles, and access credentials",
        category: "Navigation",
        icon: AnimatedUsers,
        href: "/users",
        shortcut: "⌘U",
        keywords: ["employees", "staff", "team", "admins", "operators", "supervisors", "accounts", "roles", "users"],
        roles: ["super_admin", "admin", "service_manager"],
      },
      {
        id: "action-add-machine",
        title: "Create New Machine",
        subtitle: "Register a new machine into fleet",
        category: "Quick Actions",
        icon: AnimatedPlus,
        href: "/machines?action=create",
        keywords: ["add equipment", "new device", "register", "add asset"],
        roles: ["super_admin", "admin"],
      },
      {
        id: "action-add-user",
        title: "Invite New User / Employee",
        subtitle: "Create new employee or admin user account",
        category: "Quick Actions",
        icon: AnimatedPlus,
        href: "/users?action=create",
        keywords: ["add user", "invite", "create account", "new staff"],
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
