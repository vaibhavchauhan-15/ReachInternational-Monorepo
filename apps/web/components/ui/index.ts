/**
 * ReachInternational Centralized UI Design System — Single Canonical Barrel
 * All shared UI components, form controls, date/time pickers, tables, filters,
 * export controls, modals, navigation, and layout primitives.
 */

// 1. Buttons
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";

// 2. Form Controls & Inputs
export { Input } from "./Input";
export { PasswordInput, type PasswordInputProps } from "./PasswordInput";
export { NumberInput, type NumberInputProps } from "./NumberInput";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { SearchableSelect, type SearchableSelectProps } from "./SearchableSelect";
export { MultiSelect, type MultiSelectOption, type MultiSelectProps } from "./MultiSelect";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Radio, RadioGroup, type RadioProps, type RadioGroupProps } from "./Radio";
export { Switch, type SwitchProps } from "./Switch";
export {
  FormField,
  Label,
  HelperText,
  ErrorMessage,
  type FormFieldProps,
  type LabelProps,
  type HelperTextProps,
  type ErrorMessageProps,
} from "./FormField";

// 3. Domain Specialized Selectors
export { MachineSelect, type MachineSelectProps, type MachineSelectItem } from "./MachineSelect";
export { ClientSelect, type ClientSelectProps, type ClientSelectItem } from "./ClientSelect";
export { UserSelect, type UserSelectProps, type UserSelectItem } from "./UserSelect";

// 4. Date & Time Components
export { CustomDatePicker, type CustomDatePickerProps } from "./CustomDatePicker";
export { DatePicker, type DatePickerProps } from "./DatePicker";
export { DateRangePicker, type DateRangePickerProps, type DateRange } from "./DateRangePicker";
export { CustomTimePicker, type CustomTimePickerProps } from "./CustomTimePicker";
export { TimePicker, type TimePickerProps } from "./TimePicker";
export { DateTimePicker, type DateTimePickerProps } from "./DateTimePicker";

// 5. Search & Filtering Controls
export { SearchBox, type SearchBoxProps } from "./SearchBox";
export { FilterToolbar, type FilterToolbarProps } from "./FilterToolbar";
export { FilterDropdown, type FilterDropdownOption, type FilterDropdownProps } from "./FilterDropdown";
export { SortControl, type SortControlProps } from "./SortControl";
export { FilterChips, type FilterChipsProps, type FilterChipItem } from "./FilterChips";

// 6. Tables & Data Display
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  type PaginationProps,
} from "./Table";
export { EnterpriseTable, CopyCell, type ColumnDef, type TableDensity } from "./EnterpriseTable";
export { DataTable, type DataTableProps } from "./DataTable";
export { EmptyState } from "./EmptyState";
export {
  Skeleton,
  SkeletonHeader,
  SkeletonKPI,
  SkeletonTable,
  SkeletonChartCard,
  DashboardSkeleton,
  MachinesSkeleton,
  MachineDetailSkeleton,
  NotificationsSkeleton,
  ServicesSkeleton,
  UsersSkeleton,
  OperationsSkeleton,
  ClientsSkeleton,
} from "./Skeleton";

// 7. Export Controls
export { ExportButton, type ExportButtonProps, type ExportFormat } from "./ExportButton";
export { ExportDropdown, type ExportDropdownProps } from "./ExportDropdown";

// 8. Dialogs, Modals & Feedback
export { Modal, type ModalProps } from "./Modal";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  type DialogContentProps,
  type DialogFrom,
} from "./dialog";
export { ConfirmationDialog } from "./ConfirmationDialog";
export { Alert, type AlertProps, type AlertVariant } from "./Alert";
export { Drawer, type DrawerProps } from "./Drawer";
export { ToastProvider, useToast } from "./Toast";
export { Spinner, FullPageSpinner } from "./Spinner";
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipWrapper,
  InfoTooltip,
  MetricTooltip,
  SidebarTooltip,
  TruncatedTooltip,
} from "./tooltip";

// 9. Navigation & Layout
export { PageHeader } from "./PageHeader";
export { Card, CardHeader } from "./Card";
export { Tabs, type TabsProps, type TabItem } from "./Tabs";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./Breadcrumb";
export {
  PageContainer,
  Section,
  Stack,
  Grid,
  type PageContainerProps,
  type SectionProps,
  type StackProps,
  type GridProps,
} from "./Container";
export { Badge } from "./Badge";
export { MetricCard } from "./MetricCard";
export { Sparkline } from "./Sparkline";
export { CommandPalette } from "./CommandPalette";
export { RefreshButton } from "./RefreshButton";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  GroupAvatar,
  AvatarStack,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarGroupItem,
  type AvatarSize,
  type AvatarStatus,
} from "./Avatar";
export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useSidebar,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
} from "./sidebar";

// 10. Motion & Animation
export {
  FadeIn,
  SlideUp,
  ScaleIn,
  StaggerChildren,
  StaggerItem,
  AnimatedCounter,
  AnimatedBadge,
  AnimatedProgress,
  AnimatePresence,
} from "./Motion";
export { AnimateIcon, AnimatedIcon, createAnimatedIcon } from "./animated-icon";
export type { IconAnimationVariant, IconTrigger, AnimateIconProps, AnimatedIconProps } from "./animated-icon";

// 11. Branding
export { Logo, ReachInternationalLogo, ScissorLiftLogoIcon, type LogoProps } from "./Logo";
export { BRAND_ASSETS, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";