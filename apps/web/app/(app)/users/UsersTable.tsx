"use client";

import React from "react";
import { AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { AnimatedSearch } from "@/components/ui/animated-icons";
import { Card, Button } from "@/components/ui";
import { Pagination } from "@/components/ui/Table";
import { UserRow } from "./UserRow";
import { MobileUserCard } from "./MobileUserCard";
import type { User, UserRole } from "@/lib/types/database";

export function TableSkeletonRows({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <tr key={i} className="animate-pulse border-b border-[var(--color-hairline)]/60">
          {!readOnly && (
            <td className="py-3.5 px-3 text-center">
              <div className="h-4 w-4 rounded bg-[var(--color-hairline)]/70 mx-auto" />
            </td>
          )}
          {/* Name */}
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-hairline)]/80 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-3.5 w-24 bg-[var(--color-hairline)] rounded" />
                <div className="h-2.5 w-16 bg-[var(--color-hairline)]/60 rounded" />
              </div>
            </div>
          </td>
          {/* Contact */}
          <td className="py-3.5 px-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-[var(--color-hairline)]/80 rounded" />
              <div className="h-2.5 w-36 bg-[var(--color-hairline)]/60 rounded" />
            </div>
          </td>
          {/* Role */}
          <td className="py-3.5 px-4">
            <div className="h-5 w-20 rounded-full bg-[var(--color-hairline)]/70" />
          </td>
          {/* Supervisor */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-20 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Location */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-20 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Status */}
          <td className="py-3.5 px-4">
            <div className="h-5 w-16 rounded-md bg-[var(--color-hairline)]/70" />
          </td>
          {/* Joined Date */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-20 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Actions */}
          <td className="py-3.5 px-3 text-right">
            <div className="h-7 w-7 rounded bg-[var(--color-hairline)]/60 ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function MobileUserCardSkeleton({ selectable = false }: { selectable?: boolean }) {
  return (
    <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs flex flex-col gap-2.5 relative overflow-hidden border-l-[3px] border-l-[var(--color-hairline)] select-none">
      {/* Top Header section: Checkbox, Avatar, Name, Status, Chevron */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectable && (
            <div className="h-4 w-4 rounded-[4px] bg-[var(--color-hairline)]/70 shrink-0 animate-pulse" />
          )}

          {/* Initials Avatar Placeholder */}
          <div className="h-9 w-9 rounded-lg bg-[var(--color-hairline)]/80 shrink-0 animate-pulse" />

          <div className="flex flex-col min-w-0 flex-1 gap-1.5">
            <div className="h-3.5 w-28 max-w-[70%] bg-[var(--color-hairline)] rounded animate-pulse" />
            <div className="h-2.5 w-20 max-w-[50%] bg-[var(--color-hairline)]/60 rounded animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]/70 animate-pulse" />
          <div className="h-3.5 w-3.5 rounded bg-[var(--color-hairline)]/40 animate-pulse" />
        </div>
      </div>

      {/* Metadata Row: Contact on Left, Role Badge on Bottom Right */}
      <div className="pt-2 border-t border-[var(--color-hairline)] flex items-end justify-between gap-2 text-xs">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {/* Email row placeholder */}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[var(--color-hairline)]/60 shrink-0 animate-pulse" />
            <div className="h-3 w-36 max-w-[85%] bg-[var(--color-hairline)]/70 rounded animate-pulse" />
          </div>
          {/* Phone row placeholder */}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[var(--color-hairline)]/60 shrink-0 animate-pulse" />
            <div className="h-3 w-28 max-w-[65%] bg-[var(--color-hairline)]/70 rounded animate-pulse" />
          </div>
          {/* Location / Base row placeholder */}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[var(--color-hairline)]/60 shrink-0 animate-pulse" />
            <div className="h-3 w-20 max-w-[50%] bg-[var(--color-hairline)]/50 rounded animate-pulse" />
          </div>
        </div>

        {/* Role Badge placeholder on Bottom Right */}
        <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]/80 shrink-0 self-end animate-pulse" />
      </div>
    </div>
  );
}

export function MobileCardSkeletonItems({
  count = 3,
  selectable = false,
}: {
  count?: number;
  selectable?: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <MobileUserCardSkeleton key={`mobile-user-card-skeleton-${i}`} selectable={selectable} />
      ))}
    </>
  );
}

export function MobileCardSkeletonList({
  count = 6,
  selectable = false,
}: {
  count?: number;
  selectable?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MobileCardSkeletonItems count={count} selectable={selectable} />
    </div>
  );
}

export interface UsersTableProps {
  viewMode: "auto" | "cards" | "table";
  usersList: User[];
  mobileUsersList: User[];
  currentUser: User;
  isSuperAdmin: boolean;
  readOnly?: boolean;
  loading: { type: string; id: string } | null;
  isQueryLoading: boolean;
  selectedUserIds: string[];
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
  onSelectAllFiltered: () => void;
  onToggleSelect: (userId: string) => void;
  onOpenSheet: (user: User) => void;
  onEditUser: (user: User) => void;
  onResetPassword: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
  onRoleChange: (userId: string, newRole: UserRole) => void;
  onSupervisorChange: (userId: string, supervisorIds: string[] | string | null) => void;
  onDeleteUser: (userId: string) => void;
  supervisors?: Array<{ value: string; label: string; description?: string }>;
  searchTerm: string;
  activeFilterCount: number;
  onResetFilters: () => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  mobileHasMore: boolean;
  isLoadingMoreMobile: boolean;
  loadMoreMobileError: string | null;
  onMobileRetry: () => void;
  mobileSentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function UsersTable({
  viewMode,
  usersList,
  mobileUsersList,
  currentUser,
  isSuperAdmin,
  readOnly = false,
  loading,
  isQueryLoading,
  selectedUserIds,
  allFilteredSelected,
  someFilteredSelected,
  onSelectAllFiltered,
  onToggleSelect,
  onOpenSheet,
  onEditUser,
  onResetPassword,
  onToggleStatus,
  onRoleChange,
  onSupervisorChange,
  onDeleteUser,
  supervisors,
  searchTerm,
  activeFilterCount,
  onResetFilters,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  mobileHasMore,
  isLoadingMoreMobile,
  loadMoreMobileError,
  onMobileRetry,
  mobileSentinelRef,
}: UsersTableProps) {
  return (
    <div className="relative">
      {/* Mobile / Responsive Cards View */}
      <div
        className={
          viewMode === "cards"
            ? "block"
            : viewMode === "table"
            ? "hidden"
            : "block md:hidden"
        }
      >
        {isQueryLoading ? (
          <MobileCardSkeletonList count={6} selectable={!readOnly} />
        ) : usersList.length === 0 ? (
          <div className="py-14 px-4 text-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-mute)] mb-3 shadow-xs">
              <AnimatedSearch size={22} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">No users found</h3>
            <p className="text-xs text-[var(--color-mute)] mt-1.5 max-w-xs text-center leading-relaxed">
              {searchTerm.trim() !== "" && activeFilterCount > 1
                ? `No user records match "${searchTerm}" with the active filter criteria. Try adjusting or clearing your filters.`
                : searchTerm.trim() !== ""
                ? `No user records match "${searchTerm}". Check for typos or try searching with name, phone, email, or role.`
                : activeFilterCount > 0
                ? "No users match the active filter criteria. Try adjusting or clearing some filters."
                : "No registered users in this directory."}
            </p>
            {(searchTerm.trim() !== "" || activeFilterCount > 0) && (
              <Button
                variant="ghost-sm"
                onClick={onResetFilters}
                className="mt-4 h-8 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all"
              >
                Clear Search & Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {mobileUsersList.map((u) => (
                  <MobileUserCard
                    key={u.id}
                    user={u}
                    currentUser={currentUser}
                    loadingId={loading}
                    selectable={!readOnly}
                    isSelected={selectedUserIds.includes(u.id)}
                    onToggleSelect={onToggleSelect}
                    onOpenSheet={onOpenSheet}
                    onResetPassword={onResetPassword}
                    onToggleStatus={onToggleStatus}
                    searchTerm={searchTerm}
                  />
                ))}
              </AnimatePresence>

              {/* Skeletons while loading more staff chunk-by-chunk on mobile infinite scroll */}
              {isLoadingMoreMobile && (
                <MobileCardSkeletonItems count={3} selectable={!readOnly} />
              )}
            </div>

            {/* Infinite Scroll Sentinel for Mobile View */}
            {mobileHasMore && !loadMoreMobileError && !isQueryLoading && (
              <div ref={mobileSentinelRef} className="h-6 w-full pointer-events-none" />
            )}

            {/* Pagination Load More Error with Retry */}
            {loadMoreMobileError && (
              <div className="p-3 my-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between gap-3 text-xs shadow-xs">
                <span className="text-[var(--color-error)] font-medium">{loadMoreMobileError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMobileRetry}
                  className="h-7 px-3 text-xs font-semibold rounded-md border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}

            {/* End-of-List Indicator */}
            {!mobileHasMore && mobileUsersList.length > 0 && !isQueryLoading && (
              <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
                <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                <span className="font-medium text-[var(--color-mute)]">All users have been displayed</span>
                <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
              </div>
            )}

            {/* Fallback pagination controls when explicitly in desktop cards view */}
            {viewMode === "cards" && totalCount > 0 && (
              <div className="pt-2 hidden sm:block">
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={totalCount}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div
        className={
          viewMode === "cards"
            ? "hidden"
            : viewMode === "table"
            ? "block"
            : "hidden md:block"
        }
      >
        <Card padding="none" className="overflow-hidden border border-[var(--color-hairline)] shadow-xs rounded-[var(--radius-md)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                <tr>
                  {!readOnly && (
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected && usersList.length > 0}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = someFilteredSelected;
                          }
                        }}
                        onChange={onSelectAllFiltered}
                        aria-label="Select all filtered users"
                        className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                    Name
                  </th>
                  <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                    Contact Info
                  </th>
                  <th className="py-3 px-4 w-[13%] whitespace-nowrap">
                    Role
                  </th>
                  <th className="py-3 px-4 w-[13%] whitespace-nowrap">
                    Supervisor
                  </th>
                  <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                    Location
                  </th>
                  <th className="py-3 px-4 w-[8%] whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-3 px-4 w-[9%] whitespace-nowrap">
                    Joined Date
                  </th>
                  <th className="py-3 px-3 w-10 whitespace-nowrap text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                {isQueryLoading ? (
                  <TableSkeletonRows readOnly={readOnly} />
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 8 : 9} className="py-16 px-4 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-mute)] mb-3 shadow-xs">
                          <AnimatedSearch size={22} />
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--color-ink)]">No users found</h3>
                        <p className="text-xs text-[var(--color-mute)] mt-1.5 text-center leading-relaxed">
                          {searchTerm.trim() !== "" && activeFilterCount > 1
                            ? `No user records match "${searchTerm}" with the active filter criteria. Try adjusting or clearing your filters.`
                            : searchTerm.trim() !== ""
                            ? `No user records match "${searchTerm}". Check for typos or try searching with name, phone, email, or role.`
                            : activeFilterCount > 0
                            ? "No users match the active filter criteria. Try adjusting or clearing some filters."
                            : "No registered users in this directory."}
                        </p>
                        {(searchTerm.trim() !== "" || activeFilterCount > 0) && (
                          <Button
                            variant="ghost-sm"
                            onClick={onResetFilters}
                            className="mt-4 h-8 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all"
                          >
                            Clear Search & Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUser={currentUser}
                      isSuperAdmin={isSuperAdmin}
                      loadingId={loading}
                      selectable={!readOnly}
                      isSelected={selectedUserIds.includes(u.id)}
                      supervisors={supervisors}
                      onToggleSelect={onToggleSelect}
                      onViewDetails={onOpenSheet}
                      onEdit={onEditUser}
                      onResetPassword={onResetPassword}
                      onToggleStatus={onToggleStatus}
                      onUpdateRole={onRoleChange}
                      onUpdateSupervisor={onSupervisorChange}
                      onDelete={onDeleteUser}
                      searchTerm={searchTerm}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Desktop Table Pagination Bar */}
          {!isQueryLoading && usersList.length > 0 && totalPages > 1 && (
            <div className="p-4 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                total={totalCount}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
