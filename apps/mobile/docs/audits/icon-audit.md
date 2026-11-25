# Mobile Icon Usage & Animation Audit (apps/mobile)

> Generated as part of **04 — Smooth Icon Animation Implementation**.
> Mapped against web animated icon behavior (lucide-animated.com) and Material 3 Expressive spring physics.

| Icon | Screens Used (Count) | Web Animation | Mobile Behavior |
|---|---|---|---|
| **Activity** | components/navigation/MobileBottomNav.tsx, components/navigation/MobileCommandPalette.tsx, components/navigation/MobileMenuDrawer.tsx (+2 more) (5) | none (static) | static (pressNudge inside touchables) |
| **AlertCircle** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/machines.tsx (+14 more) (17) | scale pulse on mount | pulse (single 1→1.12→1) |
| **AlertTriangle** | app/(app)/account-deletion.tsx, app/(app)/clients.tsx, app/(app)/machines.tsx (+23 more) (26) | scale pulse on mount | pulse (single 1→1.12→1) |
| **ArrowLeft** | app/(app)/account-deletion.tsx, app/(app)/terms.tsx, app/(auth)/forgot-password.tsx (+1 more) (4) | translateX -3px on hover/press | slideNudge (translateX -3dp on press) |
| **ArrowRight** | app/(auth)/forgot-password.tsx, components/dashboard/operator/OperatorDashboardCard.tsx, components/dashboard/shared/PrimaryAction.tsx (+2 more) (5) | translateX 3px on hover/press | slideNudge (translateX 3dp on press) |
| **ArrowRightLeft** | components/machines/MachineDetailView.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **ArrowUpDown** | components/machines/MachineDetailView.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **ArrowUpRight** | app/(app)/motion-lab.tsx, components/dashboard/shared/AlertWidget.tsx (2) | translateXY 2px on press | slideNudge |
| **Banknote** | app/(app)/payroll.tsx, components/navigation/MobileBottomNav.tsx, components/navigation/MobileCommandPalette.tsx (+1 more) (4) | none (static) | static (pressNudge inside touchables) |
| **Bell** | app/(app)/settings/index.tsx, app/(app)/settings/notification.tsx, components/navigation/MobileMenuDrawer.tsx (+3 more) (6) | damped rotate keyframes ±12° | ring (damped oscillation on pulseKey) |
| **Briefcase** | app/(app)/payroll.tsx, app/(app)/profile.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Building** | components/navigation/MobileProfileSheet.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Building2** | app/(app)/clients.tsx, app/(app)/dashboard.tsx, app/(app)/machines.tsx (+16 more) (19) | none (static) | static (pressNudge inside touchables) |
| **Calendar** | app/(app)/attendance.tsx, app/(app)/operations.tsx, app/(app)/payroll.tsx (+5 more) (8) | none (static) | static (pressNudge inside touchables) |
| **CalendarCheck** | app/(app)/attendance.tsx, app/(app)/dashboard.tsx, components/dashboard/admin/AdminDashboardCard.tsx (+3 more) (6) | none (static) | static (pressNudge inside touchables) |
| **Check** | app/(app)/attendance.tsx, app/(app)/operations.tsx, app/(app)/payroll.tsx (+31 more) (34) | strokeDashoffset draw + scale pop | drawStroke + pulse |
| **CheckCircle** | app/(app)/motion-lab.tsx, components/machines/MachineCategoryModal.tsx, components/machines/MachineExportModal.tsx (+1 more) (4) | strokeDashoffset draw + scale pop | drawStroke + pulse |
| **CheckCircle2** | app/(app)/account-deletion.tsx, app/(app)/clients.tsx, app/(app)/machines.tsx (+18 more) (21) | strokeDashoffset draw + scale pop | drawStroke + pulse |
| **CheckSquare** | app/(app)/users.tsx (1) | strokeDashoffset draw | drawStroke |
| **ChevronDown** | app/(app)/clients.tsx, app/(app)/machines.tsx, app/(app)/operations.tsx (+16 more) (19) | rotate 180° on toggle | rotateToggle (180°) |
| **ChevronLeft** | app/(app)/attendance.tsx, app/(app)/operations.tsx, components/machines/MachineDetailView.tsx (+1 more) (4) | slide-x -2-3px on press | slideNudge (-2-3dp on press) |
| **ChevronRight** | app/(app)/account-deletion.tsx, app/(app)/attendance.tsx, app/(app)/operations.tsx (+9 more) (12) | slide-x 2-3px on hover/press | slideNudge (2-3dp on press) |
| **ChevronUp** | app/(app)/clients.tsx, app/(app)/operations.tsx, app/(app)/payroll.tsx (+2 more) (5) | rotate 180° on toggle | rotateToggle (180°) |
| **ClipboardList** | components/navigation/MobileCommandPalette.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Clock** | app/(app)/account-deletion.tsx, app/(app)/attendance.tsx, app/(app)/clients.tsx (+33 more) (36) | none (static) | static (pressNudge inside touchables) |
| **Copy** | app/(app)/profile.tsx, components/clients/MobileClientCard.tsx, components/machines/MachineDetailView.tsx (+4 more) (7) | morph to Check for 1.2s on copy | morphPair (copy ↔ check 1.2s) |
| **Cpu** | app/(app)/settings/aboutapp.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **CreditCard** | app/(app)/payroll.tsx, app/(app)/profile.tsx, app/(auth)/onboarding.tsx (+5 more) (8) | none (static) | static (pressNudge inside touchables) |
| **Download** | components/documents/MobileDocumentViewerModal.tsx, components/machines/MachineImportModal.tsx, components/users/UserExportModal.tsx (3) | press scale nudge | pressNudge |
| **Edit** | app/(app)/profile.tsx (1) | press scale nudge | pressNudge |
| **Edit2** | app/(app)/clients.tsx, app/(app)/operations.tsx, app/(app)/payroll.tsx (+4 more) (7) | press scale nudge | pressNudge |
| **ExternalLink** | app/(app)/payroll.tsx, app/(app)/privacy.tsx, app/(app)/profile.tsx (+4 more) (7) | translateXY 2px on press | slideNudge |
| **Eye** | app/(app)/profile.tsx, app/(app)/settings/account.tsx, components/ui/Input.tsx (+1 more) (4) | slash draw across eye | morphPair (eye ↔ eye-off) |
| **EyeOff** | app/(app)/profile.tsx, app/(app)/settings/account.tsx, components/ui/Input.tsx (+1 more) (4) | slash undraw | morphPair (eye-off ↔ eye) |
| **FileCheck** | app/(app)/account-deletion.tsx, app/(app)/settings/notification.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **FileEdit** | components/dashboard/hr/HRDashboardCard.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **FileSpreadsheet** | app/(app)/dashboard.tsx, app/(app)/machines.tsx, app/(app)/users.tsx (+7 more) (10) | none (static) | static (pressNudge inside touchables) |
| **FileText** | app/(app)/operations.tsx, app/(app)/payroll.tsx, app/(app)/profile.tsx (+11 more) (14) | none (static) | static (pressNudge inside touchables) |
| **Filter** | app/(app)/users.tsx (1) | press scale nudge | pressNudge |
| **FolderTree** | components/machines/MachineCategoryModal.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Gauge** | app/(app)/running-logs.tsx, components/dashboard/manager/ManagerDashboardCard.tsx, components/dashboard/operator/OperatorDashboardCard.tsx (+5 more) (8) | none (static) | static (pressNudge inside touchables) |
| **Globe** | app/(app)/users.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **History** | app/(app)/clients.tsx, components/machines/MobileMachineCard.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Home** | components/navigation/MobileBottomNav.tsx, components/navigation/MobileCommandPalette.tsx, components/navigation/MobileMenuDrawer.tsx (+2 more) (5) | none (static) | static (pressNudge inside touchables) |
| **Image** | app/(app)/profile.tsx, components/documents/MobileDocumentViewerModal.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Info** | app/(app)/payroll.tsx, app/(app)/settings/aboutapp.tsx, app/(app)/settings/index.tsx (+8 more) (11) | none (static) | static (pressNudge inside touchables) |
| **KeyRound** | app/(app)/settings/account.tsx, app/(auth)/forgot-password.tsx, components/navigation/MobileProfileSheet.tsx (+2 more) (5) | none (static) | static (pressNudge inside touchables) |
| **Layers** | app/(app)/motion-lab.tsx, components/dashboard/admin/AdminDashboardCard.tsx, components/dashboard/manager/ManagerDashboardCard.tsx (+1 more) (4) | none (static) | static (pressNudge inside touchables) |
| **Loader2** | components/operations/OperationsExportModal.tsx (1) | continuous spin while loading | spin (continuous rotate while loading) |
| **Lock** | app/(app)/clients.tsx, app/(app)/settings/aboutapp.tsx, app/(app)/settings/account.tsx (+8 more) (11) | none (static) | static (pressNudge inside touchables) |
| **LogOut** | app/(app)/settings/index.tsx, components/navigation/MobileCommandPalette.tsx, components/navigation/MobileMenuDrawer.tsx (+2 more) (5) | none (static) | static (pressNudge inside touchables) |
| **Mail** | app/(app)/account-deletion.tsx, app/(app)/clients.tsx, app/(app)/privacy.tsx (+13 more) (16) | none (static) | static (pressNudge inside touchables) |
| **MapPin** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/profile.tsx (+12 more) (15) | none (static) | static (pressNudge inside touchables) |
| **Menu** | app/(app)/motion-lab.tsx, components/navigation/MobileBottomNav.tsx, components/navigation/MobileMenuDrawer.tsx (+1 more) (4) | morph to X / rotate crossfade | morphPair (menu ↔ x) |
| **MessageSquare** | components/machines/MachineDetailView.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Monitor** | app/(app)/settings/preference.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Moon** | app/(app)/dashboard.tsx, app/(app)/settings/preference.tsx, app/(auth)/forgot-password.tsx (+8 more) (11) | none (static) | static (pressNudge inside touchables) |
| **MoreVertical** | components/ui/MobileHeader.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Palette** | app/(app)/settings/index.tsx, app/(app)/settings/preference.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Pencil** | components/operations/MobileOperatorHistoryTab.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Phone** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/operations.tsx (+13 more) (16) | none (static) | static (pressNudge inside touchables) |
| **Plus** | app/(app)/clients.tsx, app/(app)/machines.tsx, app/(app)/users.tsx (+4 more) (7) | rotate 45° on open / press nudge | rotateToggle (45° plus ↔ x) / pressNudge |
| **Printer** | app/(app)/machines.tsx, app/(app)/operations.tsx, app/(app)/running-logs.tsx (+3 more) (6) | none (static) | static (pressNudge inside touchables) |
| **ReceiptText** | app/(app)/clients.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **RefreshCw** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/dashboard.tsx (+11 more) (14) | continuous spin while loading | spin (continuous rotate while loading) |
| **RotateCcw** | app/(app)/clients.tsx, app/(app)/machines.tsx, app/(app)/users.tsx (+4 more) (7) | counter-clockwise rotate on press | pressNudge |
| **RotateCw** | components/documents/MobileDocumentViewerModal.tsx (1) | clockwise rotate on press | pressNudge |
| **Search** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/machines.tsx (+18 more) (21) | press scale nudge | pressNudge |
| **Send** | components/operations/MobileOperatorEntryCard.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Settings** | app/(app)/dashboard.tsx, components/navigation/MobileBottomNav.tsx, components/navigation/MobileCommandPalette.tsx (+1 more) (4) | none (static) | static (pressNudge inside touchables) |
| **Share2** | components/documents/MobileDocumentViewerModal.tsx, components/machines/MachineDetailView.tsx, components/ui/SharedLinkPreviewCard.tsx (3) | press scale nudge | pressNudge |
| **Shield** | app/(app)/account-deletion.tsx, app/(app)/payroll.tsx, app/(app)/profile.tsx (+8 more) (11) | none (static) | static (pressNudge inside touchables) |
| **ShieldAlert** | app/(app)/clients.tsx, app/(app)/operations.tsx, app/(app)/profile.tsx (+6 more) (9) | scale pulse on conflict | pulse |
| **ShieldCheck** | app/(app)/clients.tsx, app/(app)/motion-lab.tsx, app/(app)/profile.tsx (+12 more) (15) | none (static) | static (pressNudge inside touchables) |
| **Sliders** | app/(app)/motion-lab.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **SlidersHorizontal** | app/(app)/clients.tsx, app/(app)/machines.tsx, app/(app)/users.tsx (+7 more) (10) | press scale nudge | pressNudge |
| **Smartphone** | app/(app)/users.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Sparkles** | app/(app)/clients.tsx, app/(app)/motion-lab.tsx, app/(app)/settings/index.tsx (+1 more) (4) | none (static) | static (pressNudge inside touchables) |
| **Square** | app/(app)/users.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Star** | lib/nav/navItems.ts (1) | none (static) | static (pressNudge inside touchables) |
| **Sun** | app/(app)/dashboard.tsx, app/(app)/settings/preference.tsx, app/(auth)/forgot-password.tsx (+6 more) (9) | none (static) | static (pressNudge inside touchables) |
| **Tag** | components/machines/MachineCategoryModal.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Timer** | components/dashboard/admin/AdminDashboardCard.tsx, components/dashboard/operator/OperatorDashboardCard.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Trash2** | app/(app)/account-deletion.tsx, app/(app)/clients.tsx, app/(app)/operations.tsx (+12 more) (15) | press scale nudge | pressNudge |
| **Truck** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/operations.tsx (+8 more) (11) | none (static) | static (pressNudge inside touchables) |
| **Type** | app/(app)/settings/preference.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Unlock** | components/operations/MobileOperatorEntryCard.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Upload** | app/(app)/profile.tsx, components/documents/MobileDocumentUploadCard.tsx (2) | press scale nudge | pressNudge |
| **User** | app/(app)/account-deletion.tsx, app/(app)/operations.tsx, app/(app)/profile.tsx (+19 more) (22) | none (static) | static (pressNudge inside touchables) |
| **UserCheck** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/settings/notification.tsx (+9 more) (12) | none (static) | static (pressNudge inside touchables) |
| **UserPlus** | app/(app)/operations.tsx, app/(app)/users.tsx, components/dashboard/hr/HRDashboardCard.tsx (+2 more) (5) | none (static) | static (pressNudge inside touchables) |
| **UserX** | app/(app)/attendance.tsx, app/(app)/users.tsx, components/operations/MobileTodayShiftMonitorTab.tsx (+1 more) (4) | none (static) | static (pressNudge inside touchables) |
| **Users** | app/(app)/attendance.tsx, app/(app)/dashboard.tsx, app/(app)/payroll.tsx (+14 more) (17) | none (static) | static (pressNudge inside touchables) |
| **Vibrate** | app/(app)/settings/preference.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **Volume2** | app/(app)/settings/notification.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **VolumeX** | app/(app)/settings/notification.tsx (1) | none (static) | static (pressNudge inside touchables) |
| **WifiOff** | components/offline/OfflineBanner.tsx, shell/screens/OfflineScreen.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Wrench** | app/(app)/clients.tsx, app/(app)/dashboard.tsx, app/(app)/machines.tsx (+16 more) (19) | none (static) | static (pressNudge inside touchables) |
| **X** | app/(app)/attendance.tsx, app/(app)/clients.tsx, app/(app)/machines.tsx (+45 more) (48) | morph / scale fade | morphPair (x / close) |
| **XCircle** | app/(app)/account-deletion.tsx, app/(app)/profile.tsx (2) | none (static) | static (pressNudge inside touchables) |
| **Zap** | app/(app)/operations.tsx, app/(app)/running-logs.tsx (2) | none (static) | static (pressNudge inside touchables) |
