"use client";

interface CareersHeroProps {
  openRoleCount?: number;
}

export function CareersHero({ openRoleCount }: CareersHeroProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-12 md:pt-16 md:pb-16 border-b border-black/[0.06] dark:border-white/[0.08]">
      {/* Background radial gradient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-25 dark:opacity-20"
        style={{ backgroundColor: "#008CFC" }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.12]">
          Build Your Career at Height.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008CFC] to-[#00B4D8]">
            Reach All Heights.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Join India&apos;s leading heavy machinery &amp; access equipment specialist. Work on landmark metro, industrial, and infrastructure projects across the nation with industry-leading safety and career advancement.
        </p>
      </div>
    </section>
  );
}

