# Component Map — ServiceCentric UI System

## Shared UI Primitives (`components/ui/*`)
- `EnterpriseTable.tsx` & `Table.tsx`: Virtualized/paginated enterprise tables with filtering & column sorting.
- `MetricCard.tsx` & `Card.tsx`: Glassmorphism KPI statistic containers.
- `Button.tsx` & `Badge.tsx`: Tailwind v4 styled interactive buttons & status badges.
- `Input.tsx`, `Select.tsx`, `SearchableSelect.tsx`: Form inputs with validation error states.
- `Modal.tsx` & `ConfirmationDialog.tsx`: Accessible dialog overlays.
- `CommandPalette.tsx`: Global `Cmd+K` keyboard shortcut navigation and quick action search.
- `Motion.tsx`: Wrapper for Framer Motion transitions (fade, slide, scale).
- `Skeleton.tsx` & `Spinner.tsx`: Loading indicators.
- `Toast.tsx`: Notification alert toasts.

## Layout Components (`components/layout/*`)
- `MobileBottomNav.tsx`: Bottom navigation bar tuned for iOS/Android mobile screens.
- `PublicNavbar.tsx`: Marketing landing navbar with smooth scroll triggers.
- `Navbar.tsx`: Authenticated app top header with user profile menu & command palette toggle.

## Landing Page Showcase Components (`components/landing/*`)
- `HeroSection.tsx`: SaaS primary headline & CTA callouts.
- `FeatureShowcaseSection.tsx`, `PlatformShowcaseSection.tsx`, `DeviceShowcaseSection.tsx`, `EngineerMobileSection.tsx`: Feature highlighting sections.
- `NotificationEngineSection.tsx`: Automated notification channel showcase.
- `EnterpriseSecuritySection.tsx`: Security & compliance badge list.
- `WorkflowSection.tsx`, `ScrollStorySection.tsx`, `AnalyticsShowcaseSection.tsx`: Interactive story & workflow animations.

## Feature Domain Components
- **Dashboard**: `components/dashboard/Charts.tsx`, `components/dashboard/ChartLoaders.tsx`
- **Machines**: `components/machines/MachineListClient.tsx`, `components/machines/MachineModal.tsx`, `components/machines/MachineRow.tsx`
- **Services**: `components/services/ServicesClient.tsx`
- **Notifications**: `components/notifications/NotificationListClient.tsx`, `components/notifications/NotificationPreviewModal.tsx`, `components/notifications/NotificationRow.tsx`
