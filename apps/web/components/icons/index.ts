"use client";

import { createAnimatedIconBridge } from "./icon-bridge";

// 1. Static Dropdown & Arrow Icons (Clean static SVGs, zero bouncy animation for dropdown selections & sorting)
export { ChevronDownIcon, ChevronDownIcon as ChevronDown } from "./chevron-down";
export { ChevronUpIcon, ChevronUpIcon as ChevronUp } from "./chevron-up";
export { ChevronsUpDownIcon, ChevronsUpDownIcon as ChevronsUpDown } from "./chevrons-up-down";

// 2. Animated Icons from lucide-animated.com wrapped with Auto-Parent-Hover & Auto-Scaling Bridge
import { ActivityIcon as RawActivity } from "./activity";
export const ActivityIcon = createAnimatedIconBridge(RawActivity, "Activity");
export const Activity = ActivityIcon;

import { ArrowDownIcon as RawArrowDown } from "./arrow-down";
export const ArrowDownIcon = createAnimatedIconBridge(RawArrowDown, "ArrowDown");
export const ArrowDown = ArrowDownIcon;

import { ArrowLeftIcon as RawArrowLeft } from "./arrow-left";
export const ArrowLeftIcon = createAnimatedIconBridge(RawArrowLeft, "ArrowLeft");
export const ArrowLeft = ArrowLeftIcon;

import { ArrowRightIcon as RawArrowRight } from "./arrow-right";
export const ArrowRightIcon = createAnimatedIconBridge(RawArrowRight, "ArrowRight");
export const ArrowRight = ArrowRightIcon;

import { ArrowUpRightIcon as RawArrowUpRight } from "./arrow-up-right";
export const ArrowUpRightIcon = createAnimatedIconBridge(RawArrowUpRight, "ArrowUpRight");
export const ArrowUpRight = ArrowUpRightIcon;

import { ArrowUpIcon as RawArrowUp } from "./arrow-up";
export const ArrowUpIcon = createAnimatedIconBridge(RawArrowUp, "ArrowUp");
export const ArrowUp = ArrowUpIcon;

import { BellIcon as RawBell } from "./bell";
export const BellIcon = createAnimatedIconBridge(RawBell, "Bell");
export const Bell = BellIcon;

import { BriefcaseBusinessIcon as RawBriefcaseBusiness } from "./briefcase-business";
export const BriefcaseBusinessIcon = createAnimatedIconBridge(RawBriefcaseBusiness, "BriefcaseBusiness");
export const BriefcaseBusiness = BriefcaseBusinessIcon;

import { CalendarCheckIcon as RawCalendarCheck } from "./calendar-check";
export const CalendarCheckIcon = createAnimatedIconBridge(RawCalendarCheck, "CalendarCheck");
export const CalendarCheck = CalendarCheckIcon;

import { CheckIcon as RawCheck } from "./check";
export const CheckIcon = createAnimatedIconBridge(RawCheck, "Check");
export const Check = CheckIcon;

import { ChevronLeftIcon as RawChevronLeft } from "./chevron-left";
export const ChevronLeftIcon = createAnimatedIconBridge(RawChevronLeft, "ChevronLeft");
export const ChevronLeft = ChevronLeftIcon;

import { ChevronRightIcon as RawChevronRight } from "./chevron-right";
export const ChevronRightIcon = createAnimatedIconBridge(RawChevronRight, "ChevronRight");
export const ChevronRight = ChevronRightIcon;

import { CircleHelpIcon as RawCircleHelp } from "./circle-help";
export const CircleHelpIcon = createAnimatedIconBridge(RawCircleHelp, "CircleHelp");
export const CircleHelp = CircleHelpIcon;

import { ClipboardCheckIcon as RawClipboardCheck } from "./clipboard-check";
export const ClipboardCheckIcon = createAnimatedIconBridge(RawClipboardCheck, "ClipboardCheck");
export const ClipboardCheck = ClipboardCheckIcon;

import { ClockIcon as RawClock } from "./clock";
export const ClockIcon = createAnimatedIconBridge(RawClock, "Clock");
export const Clock = ClockIcon;

import { CopyIcon as RawCopy } from "./copy";
export const CopyIcon = createAnimatedIconBridge(RawCopy, "Copy");
export const Copy = CopyIcon;

import { CpuIcon as RawCpu } from "./cpu";
export const CpuIcon = createAnimatedIconBridge(RawCpu, "Cpu");
export const Cpu = CpuIcon;

import { CreditCardIcon as RawCreditCard } from "./credit-card";
export const CreditCardIcon = createAnimatedIconBridge(RawCreditCard, "CreditCard");
export const CreditCard = CreditCardIcon;

import { DownloadIcon as RawDownload } from "./download";
export const DownloadIcon = createAnimatedIconBridge(RawDownload, "Download");
export const Download = DownloadIcon;

import { ExternalLinkIcon as RawExternalLink } from "./external-link";
export const ExternalLinkIcon = createAnimatedIconBridge(RawExternalLink, "ExternalLink");
export const ExternalLink = ExternalLinkIcon;

import { EyeOffIcon as RawEyeOff } from "./eye-off";
export const EyeOffIcon = createAnimatedIconBridge(RawEyeOff, "EyeOff");
export const EyeOff = EyeOffIcon;

import { EyeIcon as RawEye } from "./eye";
export const EyeIcon = createAnimatedIconBridge(RawEye, "Eye");
export const Eye = EyeIcon;

import { FileCheckIcon as RawFileCheck } from "./file-check";
export const FileCheckIcon = createAnimatedIconBridge(RawFileCheck, "FileCheck");
export const FileCheck = FileCheckIcon;

import { FileTextIcon as RawFileText } from "./file-text";
export const FileTextIcon = createAnimatedIconBridge(RawFileText, "FileText");
export const FileText = FileTextIcon;

import { GaugeIcon as RawGauge } from "./gauge";
export const GaugeIcon = createAnimatedIconBridge(RawGauge, "Gauge");
export const Gauge = GaugeIcon;

import { HistoryIcon as RawHistory } from "./history";
export const HistoryIcon = createAnimatedIconBridge(RawHistory, "History");
export const History = HistoryIcon;

import { HomeIcon as RawHome } from "./home";
export const HomeIcon = createAnimatedIconBridge(RawHome, "Home");
export const Home = HomeIcon;

import { KeyIcon as RawKey } from "./key";
export const KeyIcon = createAnimatedIconBridge(RawKey, "Key");
export const Key = KeyIcon;

import { LayersIcon as RawLayers } from "./layers";
export const LayersIcon = createAnimatedIconBridge(RawLayers, "Layers");
export const Layers = LayersIcon;

import { LoaderIcon as RawLoader } from "./loader";
export const LoaderIcon = createAnimatedIconBridge(RawLoader, "Loader");
export const Loader = LoaderIcon;

import { LockIcon as RawLock } from "./lock";
export const LockIcon = createAnimatedIconBridge(RawLock, "Lock");
export const Lock = LockIcon;

import { MapPinIcon as RawMapPin } from "./map-pin";
export const MapPinIcon = createAnimatedIconBridge(RawMapPin, "MapPin");
export const MapPin = MapPinIcon;

import { MenuIcon as RawMenu } from "./menu";
export const MenuIcon = createAnimatedIconBridge(RawMenu, "Menu");
export const Menu = MenuIcon;

import { MessageSquareIcon as RawMessageSquare } from "./message-square";
export const MessageSquareIcon = createAnimatedIconBridge(RawMessageSquare, "MessageSquare");
export const MessageSquare = MessageSquareIcon;

import { MoonIcon as RawMoon } from "./moon";
export const MoonIcon = createAnimatedIconBridge(RawMoon, "Moon");
export const Moon = MoonIcon;

import { PaletteIcon as RawPalette } from "./palette";
export const PaletteIcon = createAnimatedIconBridge(RawPalette, "Palette");
export const Palette = PaletteIcon;

import { PanelLeftCloseIcon as RawPanelLeftClose } from "./panel-left-close";
export const PanelLeftCloseIcon = createAnimatedIconBridge(RawPanelLeftClose, "PanelLeftClose");
export const PanelLeftClose = PanelLeftCloseIcon;

import { PanelLeftOpenIcon as RawPanelLeftOpen } from "./panel-left-open";
export const PanelLeftOpenIcon = createAnimatedIconBridge(RawPanelLeftOpen, "PanelLeftOpen");
export const PanelLeftOpen = PanelLeftOpenIcon;

import { PhoneIcon as RawPhone } from "./phone";
export const PhoneIcon = createAnimatedIconBridge(RawPhone, "Phone");
export const Phone = PhoneIcon;

import { PlusIcon as RawPlus } from "./plus";
export const PlusIcon = createAnimatedIconBridge(RawPlus, "Plus");
export const Plus = PlusIcon;

import { ReceiptIcon as RawReceipt } from "./receipt";
export const ReceiptIcon = createAnimatedIconBridge(RawReceipt, "Receipt");
export const Receipt = ReceiptIcon;
import { RefreshCwIcon as RawRefreshCw } from "./refresh-cw";
export const RefreshCwIcon = createAnimatedIconBridge(RawRefreshCw, "RefreshCw");
export const RefreshCw = RefreshCwIcon;
export const RefreshCW = RefreshCwIcon;

import { RotateCcwIcon as RawRotateCcw } from "./rotate-ccw";
export const RotateCcwIcon = createAnimatedIconBridge(RawRotateCcw, "RotateCcw");
export const RotateCcw = RotateCcwIcon;
export const RotateCCW = RotateCcwIcon;

import { RotateCwIcon as RawRotateCw } from "./rotate-cw";
export const RotateCwIcon = createAnimatedIconBridge(RawRotateCw, "RotateCw");
export const RotateCw = RotateCwIcon;
export const RotateCW = RotateCwIcon;

import { SearchIcon as RawSearch } from "./search";
export const SearchIcon = createAnimatedIconBridge(RawSearch, "Search");
export const Search = SearchIcon;

import { SendIcon as RawSend } from "./send";
export const SendIcon = createAnimatedIconBridge(RawSend, "Send");
export const Send = SendIcon;

import { SettingsIcon as RawSettings } from "./settings";
export const SettingsIcon = createAnimatedIconBridge(RawSettings, "Settings");
export const Settings = SettingsIcon;

import { ShieldCheckIcon as RawShieldCheck } from "./shield-check";
export const ShieldCheckIcon = createAnimatedIconBridge(RawShieldCheck, "ShieldCheck");
export const ShieldCheck = ShieldCheckIcon;

import { SlidersHorizontalIcon as RawSlidersHorizontal } from "./sliders-horizontal";
export const SlidersHorizontalIcon = createAnimatedIconBridge(RawSlidersHorizontal, "SlidersHorizontal");
export const SlidersHorizontal = SlidersHorizontalIcon;

import { SparklesIcon as RawSparkles } from "./sparkles";
export const SparklesIcon = createAnimatedIconBridge(RawSparkles, "Sparkles");
export const Sparkles = SparklesIcon;

import { SunIcon as RawSun } from "./sun";
export const SunIcon = createAnimatedIconBridge(RawSun, "Sun");
export const Sun = SunIcon;

import { TimerIcon as RawTimer } from "./timer";
export const TimerIcon = createAnimatedIconBridge(RawTimer, "Timer");
export const Timer = TimerIcon;

import { TrendingUpIcon as RawTrendingUp } from "./trending-up";
export const TrendingUpIcon = createAnimatedIconBridge(RawTrendingUp, "TrendingUp");
export const TrendingUp = TrendingUpIcon;

import { TruckIcon as RawTruck } from "./truck";
export const TruckIcon = createAnimatedIconBridge(RawTruck, "Truck");
export const Truck = TruckIcon;

import { UploadIcon as RawUpload } from "./upload";
export const UploadIcon = createAnimatedIconBridge(RawUpload, "Upload");
export const Upload = UploadIcon;

import { UserCheckIcon as RawUserCheck } from "./user-check";
export const UserCheckIcon = createAnimatedIconBridge(RawUserCheck, "UserCheck");
export const UserCheck = UserCheckIcon;

import { UserPlusIcon as RawUserPlus } from "./user-plus";
export const UserPlusIcon = createAnimatedIconBridge(RawUserPlus, "UserPlus");
export const UserPlus = UserPlusIcon;

import { UserIcon as RawUser } from "./user";
export const UserIcon = createAnimatedIconBridge(RawUser, "User");
export const User = UserIcon;

import { UsersIcon as RawUsers } from "./users";
export const UsersIcon = createAnimatedIconBridge(RawUsers, "Users");
export const Users = UsersIcon;

import { WifiIcon as RawWifi } from "./wifi";
export const WifiIcon = createAnimatedIconBridge(RawWifi, "Wifi");
export const Wifi = WifiIcon;

import { WrenchIcon as RawWrench } from "./wrench";
export const WrenchIcon = createAnimatedIconBridge(RawWrench, "Wrench");
export const Wrench = WrenchIcon;

import { XIcon as RawX } from "./x";
export const XIcon = createAnimatedIconBridge(RawX, "X");
export const X = XIcon;

import { ZapIcon as RawZap } from "./zap";
export const ZapIcon = createAnimatedIconBridge(RawZap, "Zap");
export const Zap = ZapIcon;

// 3. Complementary Animated Icons from @animateicons/react/lucide wrapped with the same Bridge
import {
  TriangleAlertIcon as RawTriangleAlert,
  CircleCheckIcon as RawCircleCheck,
  CirclePlayIcon as RawCirclePlay,
  PencilIcon as RawPencil,
  FilePenIcon as RawFilePen,
  FileSpreadsheetIcon as RawFileSpreadsheet,
  MailIcon as RawMail,
  CalendarIcon as RawCalendar,
  CalendarClockIcon as RawCalendarClock,
  TrashIcon as RawTrash,
  Trash2Icon as RawTrash2,
  PackageIcon as RawPackage,
  StoreIcon as RawStore,
  ServerIcon as RawServer,
  EllipsisVerticalIcon as RawEllipsisVertical,
  EllipsisIcon as RawEllipsis,
  TagIcon as RawTag,
  SmartphoneIcon as RawSmartphone,
  MonitorIcon as RawMonitor,
  PrinterIcon as RawPrinter,
  SaveIcon as RawSave,
  ShieldXIcon as RawShieldX,
  CameraIcon as RawCamera,
  UserXIcon as RawUserX,
  UserCogIcon as RawUserCog,
  GlobeIcon as RawGlobe,
  ImageIcon as RawImage,
  InfoIcon as RawInfo,
  KeyRoundIcon as RawKeyRound,
  LaptopIcon as RawLaptop,
  BookOpenIcon as RawBookOpen,
  SignalIcon as RawSignal,
  ArrowUpDownIcon as RawArrowUpDown,
  BanknoteIcon as RawBanknote,
  MinusIcon as RawMinus,
  CheckCheckIcon as RawCheckCheck,
  LoaderCircleIcon as RawLoaderCircle,
  TrendingDownIcon as RawTrendingDown,
  FolderOpenIcon as RawFolderOpen,
} from "@animateicons/react/lucide";

export const TriangleAlertIcon = createAnimatedIconBridge(RawTriangleAlert, "TriangleAlert");
export const TriangleAlert = TriangleAlertIcon;
export const AlertTriangle = TriangleAlertIcon;
export const AlertOctagon = TriangleAlertIcon;

export const CircleCheckIcon = createAnimatedIconBridge(RawCircleCheck, "CircleCheck");
export const CircleCheck = CircleCheckIcon;
export const CheckCircle = CircleCheckIcon;
export const CheckCircle2 = CircleCheckIcon;

export const CirclePlayIcon = createAnimatedIconBridge(RawCirclePlay, "CirclePlay");
export const CirclePlay = CirclePlayIcon;
export const PlayCircle = CirclePlayIcon;

export const PencilIcon = createAnimatedIconBridge(RawPencil, "Pencil");
export const Pencil = PencilIcon;
export const Edit = PencilIcon;
export const Edit2 = PencilIcon;
export const Edit3 = PencilIcon;

export const FilePenIcon = createAnimatedIconBridge(RawFilePen, "FilePen");
export const FilePen = FilePenIcon;
export const FileEdit = FilePenIcon;

export const FileSpreadsheetIcon = createAnimatedIconBridge(RawFileSpreadsheet, "FileSpreadsheet");
export const FileSpreadsheet = FileSpreadsheetIcon;

export const MailIcon = createAnimatedIconBridge(RawMail, "Mail");
export const Mail = MailIcon;

export const CalendarIcon = createAnimatedIconBridge(RawCalendar, "Calendar");
export const Calendar = CalendarIcon;

export const CalendarClockIcon = createAnimatedIconBridge(RawCalendarClock, "CalendarClock");
export const CalendarClock = CalendarClockIcon;

export const TrashIcon = createAnimatedIconBridge(RawTrash, "Trash");
export const Trash = TrashIcon;

export const Trash2Icon = createAnimatedIconBridge(RawTrash2, "Trash2");
export const Trash2 = Trash2Icon;

export const PackageIcon = createAnimatedIconBridge(RawPackage, "Package");
export const Package = PackageIcon;

export const StoreIcon = createAnimatedIconBridge(RawStore, "Store");
export const Store = StoreIcon;
export const Building = StoreIcon;
export const Building2 = StoreIcon;

export const ServerIcon = createAnimatedIconBridge(RawServer, "Server");
export const Server = ServerIcon;
export const Database = ServerIcon;

export const EllipsisVerticalIcon = createAnimatedIconBridge(RawEllipsisVertical, "EllipsisVertical");
export const EllipsisVertical = EllipsisVerticalIcon;
export const MoreVertical = EllipsisVerticalIcon;

export const EllipsisIcon = createAnimatedIconBridge(RawEllipsis, "Ellipsis");
export const Ellipsis = EllipsisIcon;
export const MoreHorizontal = EllipsisIcon;

export const TagIcon = createAnimatedIconBridge(RawTag, "Tag");
export const Tag = TagIcon;
export const Hash = TagIcon;

export const SmartphoneIcon = createAnimatedIconBridge(RawSmartphone, "Smartphone");
export const Smartphone = SmartphoneIcon;

export const MonitorIcon = createAnimatedIconBridge(RawMonitor, "Monitor");
export const Monitor = MonitorIcon;

export const PrinterIcon = createAnimatedIconBridge(RawPrinter, "Printer");
export const Printer = PrinterIcon;

export const SaveIcon = createAnimatedIconBridge(RawSave, "Save");
export const Save = SaveIcon;

export const ShieldXIcon = createAnimatedIconBridge(RawShieldX, "ShieldX");
export const ShieldX = ShieldXIcon;
export const ShieldAlert = ShieldXIcon;

export const CameraIcon = createAnimatedIconBridge(RawCamera, "Camera");
export const Camera = CameraIcon;

export const UserXIcon = createAnimatedIconBridge(RawUserX, "UserX");
export const UserX = UserXIcon;

export const UserCogIcon = createAnimatedIconBridge(RawUserCog, "UserCog");
export const UserCog = UserCogIcon;

export const GlobeIcon = createAnimatedIconBridge(RawGlobe, "Globe");
export const Globe = GlobeIcon;

export const ImageIcon = createAnimatedIconBridge(RawImage, "Image");
export const Image = ImageIcon;

export const InfoIcon = createAnimatedIconBridge(RawInfo, "Info");
export const Info = InfoIcon;

export const KeyRoundIcon = createAnimatedIconBridge(RawKeyRound, "KeyRound");
export const KeyRound = KeyRoundIcon;

export const LaptopIcon = createAnimatedIconBridge(RawLaptop, "Laptop");
export const Laptop = LaptopIcon;

export const BookOpenIcon = createAnimatedIconBridge(RawBookOpen, "BookOpen");
export const BookOpen = BookOpenIcon;

export const SignalIcon = createAnimatedIconBridge(RawSignal, "Signal");
export const Signal = SignalIcon;

export const ArrowUpDownIcon = createAnimatedIconBridge(RawArrowUpDown, "ArrowUpDown");
export const ArrowUpDown = ArrowUpDownIcon;

export const BanknoteIcon = createAnimatedIconBridge(RawBanknote, "Banknote");
export const Banknote = BanknoteIcon;

export const MinusIcon = createAnimatedIconBridge(RawMinus, "Minus");
export const Minus = MinusIcon;

export const CheckCheckIcon = createAnimatedIconBridge(RawCheckCheck, "CheckCheck");
export const CheckCheck = CheckCheckIcon;

export const LoaderCircleIcon = createAnimatedIconBridge(RawLoaderCircle, "LoaderCircle");
export const LoaderCircle = LoaderCircleIcon;
export const Loader2 = LoaderCircleIcon;

export const TrendingDownIcon = createAnimatedIconBridge(RawTrendingDown, "TrendingDown");
export const TrendingDown = TrendingDownIcon;

export const FolderOpenIcon = createAnimatedIconBridge(RawFolderOpen, "FolderOpen");
export const FolderOpen = FolderOpenIcon;
