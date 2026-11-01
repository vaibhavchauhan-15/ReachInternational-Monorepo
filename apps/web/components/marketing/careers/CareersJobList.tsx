"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  Briefcase,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  X,
  RotateCcw,
} from "lucide-react";
import { FilterDropdown, type FilterDropdownOption } from "@/components/ui/FilterDropdown";
import type { PublicJobListItem, PublicJobFilters } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface CareersJobListProps {
  initialJobs: PublicJobListItem[];
  total: number;
  filters: PublicJobFilters;
}

export function CareersJobList({ initialJobs, total, filters }: CareersJobListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedDept, setSelectedDept] = useState(searchParams.get("department") || "all");
  const [selectedType, setSelectedType] = useState(searchParams.get("type") || "all");
  const [selectedWorkplace, setSelectedWorkplace] = useState(searchParams.get("workplace") || "all");

  // Dropdown options
  const departmentOptions: FilterDropdownOption[] = useMemo(() => [
    { value: "all", label: "All Departments", count: total },
    ...filters.departments.map((dept) => ({
      value: dept.slug,
      label: dept.name,
      count: dept.count,
    })),
  ], [filters.departments, total]);

  const workplaceOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Workplaces" },
    { value: "onsite", label: "On-Site" },
    { value: "hybrid", label: "Hybrid" },
    { value: "remote", label: "Remote" },
  ];

  const typeOptions: FilterDropdownOption[] = [
    { value: "all", label: "All Employment Types" },
    { value: "full_time", label: "Full Time" },
    { value: "contract", label: "Contract" },
    { value: "internship", label: "Internship" },
    { value: "part_time", label: "Part Time" },
  ];

  const hasActiveFilters = Boolean(
    search.trim() ||
    (selectedDept && selectedDept !== "all") ||
    (selectedType && selectedType !== "all") ||
    (selectedWorkplace && selectedWorkplace !== "all")
  );

  const handleResetFilters = () => {
    setSearch("");
    setSelectedDept("all");
    setSelectedType("all");
    setSelectedWorkplace("all");
  };

  // Client-side filtering for fast instant responsiveness
  const filteredJobs = useMemo(() => {
    return initialJobs.filter((job) => {
      if (selectedDept !== "all" && job.department_slug !== selectedDept) {
        return false;
      }
      if (selectedType !== "all" && job.employment_type !== selectedType) {
        return false;
      }
      if (selectedWorkplace !== "all" && job.workplace_type !== selectedWorkplace) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesCity = job.city.toLowerCase().includes(q);
        const matchesSummary = job.summary.toLowerCase().includes(q);
        const matchesCode = job.job_code.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCity && !matchesSummary && !matchesCode) {
          return false;
        }
      }
      return true;
    });
  }, [initialJobs, selectedDept, selectedType, selectedWorkplace, search]);

  return (
    <section id="open-roles" className="py-16 md:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
      {/* Section Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
          Current Openings
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Explore Opportunities at Reach
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Showing {filteredJobs.length} of {total} open positions across India
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title, location, or keywords..."
            className="w-full h-11 pl-10 pr-9 text-xs rounded-xl bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#008CFC]/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Custom Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          {/* Department Filter - by default 'all' selected */}
          <FilterDropdown
            label="Department"
            value={selectedDept}
            onChange={setSelectedDept}
            options={departmentOptions}
            className="w-full"
            dropdownClassName="w-full sm:w-64"
            buttonClassName="h-11 rounded-xl px-3.5"
            searchable={departmentOptions.length > 5}
            searchPlaceholder="Search departments..."
          />

          {/* Workplace Filter */}
          <FilterDropdown
            label="Workplace"
            value={selectedWorkplace}
            onChange={setSelectedWorkplace}
            options={workplaceOptions}
            className="w-full"
            dropdownClassName="w-full sm:w-48"
            buttonClassName="h-11 rounded-xl px-3.5"
          />

          {/* Employment Type Filter */}
          <FilterDropdown
            label="Type"
            value={selectedType}
            onChange={setSelectedType}
            options={typeOptions}
            className="w-full"
            dropdownClassName="w-full sm:w-56"
            buttonClassName="h-11 rounded-xl px-3.5"
          />
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-11 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl border border-border/80 transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Job Cards Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-[#171717] rounded-3xl border border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Briefcase className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No matching open roles found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            We couldn&apos;t find roles matching your current search or filter options. Try resetting filters or submit a general application.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-[#008CFC] hover:underline px-3 py-1.5 cursor-pointer"
            >
              Reset Filters
            </button>
            <a
              href="#general-apply"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#008CFC] text-white hover:bg-[#0070CA] transition-colors"
            >
              Submit General Application
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/careers/${job.slug}`}
              className="group p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] hover:border-[#008CFC]/40 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Meta Top: Department & Featured */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/10 text-[#008CFC]">
                    {job.department_name}
                  </span>
                  {job.is_featured && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <Sparkles className="size-3" /> Featured
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-[#008CFC] transition-colors">
                  {job.title}
                </h3>

                {/* Summary */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {job.summary}
                </p>

                {/* Attributes Strip */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground/70" />
                    <span>{job.city}{job.state_name ? `, ${job.state_name}` : ""}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 capitalize">
                    <Briefcase className="size-3.5 text-muted-foreground/70" />
                    <span>{job.employment_type.replace("_", " ")} ({job.workplace_type})</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5 text-muted-foreground/70" />
                    <span>{job.min_experience_years}{job.max_experience_years ? `-${job.max_experience_years}` : "+"} Yrs</span>
                  </span>
                </div>
              </div>

              {/* Bottom: Compensation & CTA */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <div>
                  {job.salary_min ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{job.salary_min.toLocaleString()}{job.salary_max ? ` - ₹${job.salary_max.toLocaleString()}` : ""} / {job.salary_period || "mo"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Competitive Compensation</span>
                  )}
                </div>

                <div className="inline-flex items-center gap-1 text-xs font-bold text-[#008CFC] group-hover:translate-x-0.5 transition-transform">
                  <span>View Details & Apply</span>
                  <ArrowRight className="size-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
