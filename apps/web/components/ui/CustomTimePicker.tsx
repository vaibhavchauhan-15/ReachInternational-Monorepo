"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

export interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  iconColor?: string;
  className?: string;
  disabled?: boolean;
}

// 12 clock positions starting from 12 o'clock top (index 0) clockwise
const DISPLAY_HOURS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const FORMATTED_HOURS = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// SVG Geometry Constants for Dial
const DIAL_SIZE = 256;
const CENTER = DIAL_SIZE / 2; // 128
const RADIUS = 92; // Distance from center to numbers

export function CustomTimePicker({
  value,
  onChange,
  label,
  required = false,
  placeholder = "e.g. 08:00 AM",
  iconColor = "text-sky-500",
  className = "",
  disabled = false,
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<"hour" | "minute">("hour");
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPositionReady, setIsPositionReady] = useState(false);

  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; openAbove: boolean }>({
    top: -9999,
    left: -9999,
    openAbove: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse current value into HH, MM, AM/PM
  const parsedTime = useMemo(() => {
    const match = (value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      const h = parseInt(match[1], 10);
      const formattedH = h >= 1 && h <= 12 ? String(h).padStart(2, "0") : "08";
      const formattedM = match[2] || "00";
      const period = (match[3] || "AM").toUpperCase();
      return { hour: formattedH, minute: formattedM, period };
    }
    return { hour: "08", minute: "00", period: "AM" };
  }, [value]);

  const updateTime = useCallback(
    (h: string, m: string, p: string) => {
      const formatted = `${h}:${m} ${p}`;
      onChange(formatted);
    },
    [onChange]
  );

  // Calculate dynamic viewport positioning
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = popoverRef.current ? popoverRef.current.offsetHeight : 370;
    const popoverWidth = popoverRef.current ? popoverRef.current.offsetWidth : 280;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let openAbove = false;
    if (spaceBelow < popoverHeight + 12 && spaceAbove > spaceBelow) {
      openAbove = true;
    }

    let calculatedTop = openAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8;
    calculatedTop = Math.max(12, Math.min(calculatedTop, viewportHeight - popoverHeight - 12));

    let calculatedLeft = rect.left;
    if (calculatedLeft + popoverWidth > viewportWidth - 12) {
      calculatedLeft = Math.max(12, viewportWidth - popoverWidth - 12);
    }
    if (calculatedLeft < 12) {
      calculatedLeft = 12;
    }

    if (viewportWidth < 640) {
      calculatedLeft = Math.max(8, (viewportWidth - Math.min(popoverWidth, viewportWidth - 16)) / 2);
    }

    setPopoverPos({
      top: calculatedTop,
      left: calculatedLeft,
      openAbove,
    });
    setIsPositionReady(true);
  }, []);

  // Update position synchronously when popover opens
  useLayoutEffect(() => {
    if (isOpen) {
      setActiveMode("hour");
      updatePosition();
    } else {
      setIsPositionReady(false);
    }
  }, [isOpen, updatePosition]);

  // Event listeners for window resize, scroll, and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  // Convert pointer coordinates to radial index (0..11)
  const getAngleIndexFromCoords = useCallback((clientX: number, clientY: number) => {
    if (!clockRef.current) return 0;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clickX = clientX - centerX;
    const clickY = clientY - centerY;

    let angleRad = Math.atan2(clickY, clickX);
    let angleDeg = (angleRad * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;

    return Math.round(angleDeg / 30) % 12;
  }, []);

  // Process Dial interaction (drag or click)
  const processDialInteraction = useCallback(
    (clientX: number, clientY: number, isFinal: boolean = false) => {
      const index = getAngleIndexFromCoords(clientX, clientY);

      if (activeMode === "hour") {
        const selectedHour = FORMATTED_HOURS[index];
        updateTime(selectedHour, parsedTime.minute, parsedTime.period);
        if (isFinal) {
          setActiveMode("minute");
        }
      } else {
        const selectedMin = MINUTES[index];
        updateTime(parsedTime.hour, selectedMin, parsedTime.period);
      }
    },
    [activeMode, getAngleIndexFromCoords, parsedTime.hour, parsedTime.minute, parsedTime.period, updateTime]
  );

  // Global window listeners for drag events
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      processDialInteraction(e.clientX, e.clientY, false);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      processDialInteraction(e.clientX, e.clientY, true);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        processDialInteraction(e.touches[0].clientX, e.touches[0].clientY, false);
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      setIsDragging(false);
      if (e.changedTouches.length > 0) {
        processDialInteraction(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("touchmove", handleWindowTouchMove);
    window.addEventListener("touchend", handleWindowTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };
  }, [isDragging, processDialInteraction]);

  // Dial pointer start handlers
  const handleMouseDownOnDial = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    setIsDragging(true);
    processDialInteraction(e.clientX, e.clientY, false);
  };

  const handleTouchStartOnDial = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      setIsDragging(true);
      processDialInteraction(e.touches[0].clientX, e.touches[0].clientY, false);
    }
  };

  // Index of active selection on clock dial (0..11)
  const currentAngleIndex = useMemo(() => {
    if (activeMode === "hour") {
      const idx = FORMATTED_HOURS.indexOf(parsedTime.hour);
      return idx >= 0 ? idx : 8; // Default to 08
    } else {
      const minNum = parseInt(parsedTime.minute, 10) || 0;
      const roundedMin = (Math.round(minNum / 5) * 5) % 60;
      const formattedMin = String(roundedMin).padStart(2, "0");
      const idx = MINUTES.indexOf(formattedMin);
      return idx >= 0 ? idx : 0;
    }
  }, [activeMode, parsedTime.hour, parsedTime.minute]);

  // Coordinates of hand needle tip
  const tipCoords = useMemo(() => {
    const angleDeg = currentAngleIndex * 30 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = CENTER + RADIUS * Math.cos(angleRad);
    const y = CENTER + RADIUS * Math.sin(angleRad);
    return { x, y };
  }, [currentAngleIndex]);

  // Selected value text inside tip badge
  const selectedBadgeValue = useMemo(() => {
    if (activeMode === "hour") {
      const idx = FORMATTED_HOURS.indexOf(parsedTime.hour);
      return idx >= 0 ? DISPLAY_HOURS[idx] : parseInt(parsedTime.hour, 10).toString();
    } else {
      return parsedTime.minute;
    }
  }, [activeMode, parsedTime.hour, parsedTime.minute]);

  const handleSetNow = useCallback(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    let istHour = 0;
    let istMinute = 0;
    let istSecond = 0;

    for (const part of parts) {
      if (part.type === "hour") {
        const h = parseInt(part.value, 10);
        istHour = h === 24 ? 0 : h;
      } else if (part.type === "minute") {
        istMinute = parseInt(part.value, 10);
      } else if (part.type === "second") {
        istSecond = parseInt(part.value, 10);
      }
    }

    const totalSeconds = istHour * 3600 + istMinute * 60 + istSecond;
    const roundedTotalSeconds = Math.round(totalSeconds / 300) * 300;

    const finalHour24 = Math.floor(roundedTotalSeconds / 3600) % 24;
    const finalMinute = Math.floor((roundedTotalSeconds % 3600) / 60);

    const period = finalHour24 >= 12 ? "PM" : "AM";
    const displayHour = finalHour24 % 12 || 12;

    const formattedH = String(displayHour).padStart(2, "0");
    const formattedM = String(finalMinute).padStart(2, "0");

    updateTime(formattedH, formattedM, period);
  }, [updateTime]);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            title="Click to open time picker"
          >
            <Clock className={`h-3.5 w-3.5 ${iconColor}`} />
          </button>
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 dark:focus:ring-sky-400/20 dark:focus:border-sky-400 transition-all shadow-2xs cursor-pointer"
        />

        {/* Time Icon Button inside Input */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`absolute right-2.5 p-1 rounded-lg hover:bg-[var(--color-canvas-elevated)] transition-colors cursor-pointer ${
            isOpen ? "text-sky-600 dark:text-sky-400" : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          }`}
          title="Open Clock Time Picker"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {/* Clock Picker Dialog Popover */}
      {mounted &&
        isOpen &&
        createPortal(
          <>
            {/* Backdrop for click outside & viewport focus lock */}
            <div
              className="fixed inset-0 z-[9998] bg-black/10 dark:bg-black/30 backdrop-blur-[1px] transition-opacity duration-150"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={popoverRef}
              style={{
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                opacity: isPositionReady ? 1 : 0,
              }}
              className={`fixed z-[9999] w-[280px] sm:w-[320px] max-w-[calc(100vw-16px)] rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 shadow-floating space-y-2.5 sm:space-y-3.5 backdrop-blur-md max-h-[calc(100vh-24px)] overflow-y-auto transition-opacity duration-150 animate-in fade-in zoom-in-95 ${
                popoverPos.openAbove ? "slide-in-from-bottom-2" : "slide-in-from-top-2"
              }`}
            >
              {/* Top Header Label */}
              <div className="text-[11px] font-mono font-bold text-[var(--color-mute)] tracking-wider uppercase px-0.5 flex items-center justify-between">
                <span>SELECT TIME</span>
                <span className="text-[10px] text-sky-500 font-normal">
                  {activeMode === "hour" ? "Select Hour" : "Select Minute"}
                </span>
              </div>

              {/* Digital Time Header & AM/PM Switcher Box */}
              <div className="flex items-center justify-between gap-2">
                {/* Hour Display Card */}
                <button
                  type="button"
                  onClick={() => setActiveMode("hour")}
                  className={`flex-1 h-13 sm:h-16 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${
                    activeMode === "hour"
                      ? "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40 shadow-2xs font-bold"
                      : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border-transparent hover:bg-[var(--color-hairline)]"
                  }`}
                  title="Click to select Hour"
                >
                  <span className="text-2xl sm:text-4xl font-mono font-normal tracking-tight">
                    {parsedTime.hour}
                  </span>
                </button>

                {/* Separator Colon */}
                <span className="text-2xl sm:text-3xl font-light text-[var(--color-ink)] select-none pb-0.5">
                  :
                </span>

                {/* Minute Display Card */}
                <button
                  type="button"
                  onClick={() => setActiveMode("minute")}
                  className={`flex-1 h-13 sm:h-16 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${
                    activeMode === "minute"
                      ? "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40 shadow-2xs font-bold"
                      : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border-transparent hover:bg-[var(--color-hairline)]"
                  }`}
                  title="Click to select Minute"
                >
                  <span className="text-2xl sm:text-4xl font-mono font-normal tracking-tight">
                    {parsedTime.minute}
                  </span>
                </button>

                {/* AM / PM Segmented Switcher */}
                <div className="h-13 sm:h-16 w-11 sm:w-13 rounded-xl border border-[var(--color-hairline)] flex flex-col overflow-hidden bg-[var(--color-canvas)] shrink-0">
                  <button
                    type="button"
                    onClick={() => updateTime(parsedTime.hour, parsedTime.minute, "AM")}
                    className={`flex-1 flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      parsedTime.period === "AM"
                        ? "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTime(parsedTime.hour, parsedTime.minute, "PM")}
                    className={`flex-1 flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all cursor-pointer border-t border-[var(--color-hairline)] ${
                      parsedTime.period === "PM"
                        ? "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>

              {/* PRECISION SVG CIRCULAR CLOCK DIAL UI */}
              <div className="relative w-48 h-48 sm:w-58 sm:h-58 mx-auto select-none">
                <svg
                  ref={clockRef}
                  viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
                  onMouseDown={handleMouseDownOnDial}
                  onTouchStart={handleTouchStartOnDial}
                  className="w-full h-full cursor-pointer touch-none"
                >
                  {/* Dial Face Background Circle */}
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={CENTER - 2}
                    className="fill-[var(--color-hairline-soft-surface)] stroke-[var(--color-hairline)]"
                    strokeWidth="1"
                  />

                  {/* Clock Needle Hand Line */}
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={tipCoords.x}
                    y2={tipCoords.y}
                    className="stroke-sky-500 dark:stroke-sky-400"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      transition: isDragging ? "none" : "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  />

                  {/* Center Pivot Dot */}
                  <circle cx={CENTER} cy={CENTER} r="6" className="fill-sky-500 dark:fill-sky-400" />

                  {/* Needle Tip Badge (Circle at hand tip) */}
                  <circle
                    cx={tipCoords.x}
                    cy={tipCoords.y}
                    r="21"
                    className="fill-sky-500 dark:fill-sky-400"
                    style={{
                      transition: isDragging ? "none" : "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  />

                  {/* Needle Tip Text */}
                  <text
                    x={tipCoords.x}
                    y={tipCoords.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="15"
                    fontWeight="600"
                    fontFamily="sans-serif"
                    style={{
                      transition: isDragging ? "none" : "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    {selectedBadgeValue}
                  </text>

                  {/* Dial Numbers (12 radial positions) */}
                  {(activeMode === "hour" ? DISPLAY_HOURS : MINUTES).map((val, idx) => {
                    const isSelected = currentAngleIndex === idx;
                    if (isSelected) return null; // Skip rendering unselected number underneath tip badge

                    const angleDeg = idx * 30 - 90;
                    const angleRad = (angleDeg * Math.PI) / 180;
                    const x = CENTER + RADIUS * Math.cos(angleRad);
                    const y = CENTER + RADIUS * Math.sin(angleRad);

                    return (
                      <text
                        key={val}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-[var(--color-ink)] select-none font-medium text-sm pointer-events-none"
                      >
                        {val}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer min-h-[36px]"
                  title="Set to current local time"
                >
                  Set Now
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer min-h-[36px]"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer min-h-[36px]"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
