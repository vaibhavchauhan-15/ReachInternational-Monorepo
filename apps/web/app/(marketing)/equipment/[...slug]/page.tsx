import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getSegmentBySlug,
  getCategoryBySlug,
  getEquipmentCategories,
  getEquipmentBySlug,
  getEquipmentList,
  getAvailableFilters,
  getRelatedEquipment,
} from "@/lib/queries/equipment";
import { CategoryListingView } from "@/components/equipment/CategoryListingView";
import { EquipmentDetailView } from "@/components/equipment/EquipmentDetailView";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildEquipmentItemListJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo/jsonld";

export const revalidate = 3600; // 1 hour tag-invalidated ISR

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const CATEGORY_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  "boom-lifts": [
    {
      q: "What is the difference between articulating and telescopic boom lifts?",
      a: "Articulated boom lifts feature jointed sections that allow operators to reach 'up and over' obstacles in congested facilities. Telescopic boom lifts extend straight out with greater horizontal outreach and maximum vertical reach, ideal for open construction sites.",
    },
    {
      q: "Do you supply licensed operators with boom lift rentals?",
      a: "Yes. Reach International provides factory-trained and statutory certified equipment operators for all short-term and long-term rental contracts across India.",
    },
    {
      q: "What is your emergency breakdown response time on site?",
      a: "We maintain a dedicated fleet of mobile service vans and certified engineers across major industrial clusters, guaranteeing on-site technician response or resolution in under 2 hours.",
    },
  ],
  "scissor-lifts": [
    {
      q: "Can slab scissor lifts be used on outdoor unpaved terrain?",
      a: "Electric slab scissor lifts are designed exclusively for flat, level concrete or finished surfaces with non-marking tyres. For unpaved, uneven, or muddy outdoor ground, we deploy rough-terrain 4WD diesel scissor lifts with active oscillating axles.",
    },
    {
      q: "How long does a full electric scissor lift battery charge last?",
      a: "Modern electric scissor lifts provide 8 to 12 hours of continuous duty on a single overnight charge, easily covering full dual-shift operations.",
    },
  ],
  forklifts: [
    {
      q: "What are the advantages of Lithium-Ion (LiFePO4) forklifts over diesel or lead-acid?",
      a: "Lithium-Ion forklifts produce zero harmful emissions, require zero battery watering or acid maintenance, and support rapid 1-hour opportunity charging during operator shifts, eliminating spare battery rooms.",
    },
    {
      q: "Do your forklift rentals include comprehensive maintenance?",
      a: "Yes. All Reach International forklift leases include comprehensive preventive maintenance, hydraulic inspections, tyre replacements, and statutory safety documentation.",
    },
  ],
  "reach-trucks": [
    {
      q: "What aisle width is required for your high-lift reach trucks?",
      a: "Our reach trucks operate comfortably in narrow aisles ranging from 2.6m to 3.0m, increasing warehouse floor storage density by up to 35% compared to standard counterbalanced forklifts.",
    },
  ],
};

// ============================================================================
// Dynamic SEO Metadata Generation
// ============================================================================
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = "https://www.reachinternational.co.in";

  if (!slug || slug.length === 0) {
    return { title: "Equipment Catalogue | Reach International" };
  }

  // Case 1: Segment Route (e.g. /equipment/awp)
  if (slug.length === 1) {
    const segment = await getSegmentBySlug(slug[0]);
    if (segment) {
      return {
        title: `${segment.name} — Aerial & Access Fleet Rental & Sale | Reach International`,
        description:
          segment.description ||
          `Explore verified ${segment.name} machinery for short and long term hire or purchase across India.`,
        alternates: { canonical: `${baseUrl}/equipment/${segment.slug}` },
        openGraph: {
          title: `${segment.name} | Reach International`,
          description: segment.description || "",
          url: `${baseUrl}/equipment/${segment.slug}`,
          siteName: "Reach International",
          locale: "en_IN",
          type: "website",
        },
      };
    }
  }

  // Case 2: Category Listing or Product Detail
  if (slug.length === 2) {
    const [first, second] = slug;

    // Check if first is segment and second is category
    const category = await getCategoryBySlug(second);
    if (category) {
      return {
        title: `${category.name} — Technical Specs, Rental & Purchase Across India | Reach International`,
        description:
          category.description ||
          `Browse certified ${category.name} from leading OEMs including JLG, Genie, JCB, and Toyota. Flexible rental agreements and direct purchase.`,
        alternates: { canonical: `${baseUrl}/equipment/${first}/${second}` },
        openGraph: {
          title: `${category.name} | Reach International`,
          description: category.description || "",
          url: `${baseUrl}/equipment/${first}/${second}`,
          images: category.image_url ? [{ url: category.image_url }] : [],
          siteName: "Reach International",
          locale: "en_IN",
          type: "website",
        },
      };
    }

    // Check if second is equipment model slug
    const equipment = await getEquipmentBySlug(second);
    if (equipment) {
      return {
        title: `${equipment.model_name} Specifications, Rental & Price Quote | Reach International`,
        description: equipment.short_description,
        alternates: { canonical: `${baseUrl}/equipment/${equipment.category.slug}/${equipment.slug}` },
        openGraph: {
          title: `${equipment.model_name} | Reach International`,
          description: equipment.short_description,
          url: `${baseUrl}/equipment/${equipment.category.slug}/${equipment.slug}`,
          images: [{ url: equipment.primary_image_url }],
          siteName: "Reach International",
          locale: "en_IN",
          type: "website",
        },
      };
    }
  }

  // Case 3: /equipment/[segment]/[category]/[model]
  if (slug.length === 3) {
    const equipment = await getEquipmentBySlug(slug[2]);
    if (equipment) {
      return {
        title: `${equipment.model_name} Specifications, Rental & Price Quote | Reach International`,
        description: equipment.short_description,
        alternates: { canonical: `${baseUrl}/equipment/${equipment.category.slug}/${equipment.slug}` },
        openGraph: {
          title: `${equipment.model_name} | Reach International`,
          description: equipment.short_description,
          url: `${baseUrl}/equipment/${equipment.category.slug}/${equipment.slug}`,
          images: [{ url: equipment.primary_image_url }],
          siteName: "Reach International",
          locale: "en_IN",
          type: "website",
        },
      };
    }
  }

  return { title: "Equipment | Reach International" };
}

// ============================================================================
// Page Component Handler
// ============================================================================
export default async function EquipmentCatchAllPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  if (!slug || slug.length === 0) {
    notFound();
  }

  // Parse search params for listings
  const brandParam = typeof rawSearchParams.brand === "string" ? rawSearchParams.brand : undefined;
  const subtypeParam = typeof rawSearchParams.subtype === "string" ? rawSearchParams.subtype : undefined;
  const powerParam = typeof rawSearchParams.power === "string" ? rawSearchParams.power : undefined;
  const rentalParam = rawSearchParams.rental === "true";
  const purchaseParam = rawSearchParams.purchase === "true";
  const queryParam = typeof rawSearchParams.q === "string" ? rawSearchParams.q : undefined;
  const sortParam = typeof rawSearchParams.sort === "string" ? (rawSearchParams.sort as any) : "featured";
  const pageParam = typeof rawSearchParams.page === "string" ? parseInt(rawSearchParams.page, 10) : 1;

  // --------------------------------------------------------------------------
  // ROUTE RESOLVER: Case 1: /equipment/[segment]
  // --------------------------------------------------------------------------
  if (slug.length === 1) {
    const segment = await getSegmentBySlug(slug[0]);
    if (!segment) {
      notFound();
    }

    const [allCategoriesInSegment, filterOptions, equipmentList] = await Promise.all([
      getEquipmentCategories(segment.slug),
      getAvailableFilters(undefined, segment.slug),
      getEquipmentList({
        segment: segment.slug,
        brand: brandParam,
        subtype: subtypeParam,
        power: powerParam,
        rental: rentalParam || undefined,
        purchase: purchaseParam || undefined,
        query: queryParam,
        sort: sortParam,
        page: pageParam,
        limit: 12,
      }),
    ]);

    const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
      { label: "Equipment", href: "/equipment" },
      { label: segment.name, href: `/equipment/${segment.slug}` },
    ]);

    const itemListJsonLd = buildEquipmentItemListJsonLd(
      `${segment.name} Fleet`,
      equipmentList.items.map((m, i) => ({
        name: m.model_name,
        url: `/equipment/${m.category.slug}/${m.slug}`,
        image: m.primary_image_url,
        position: i + 1,
      }))
    );

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
        <CategoryListingView
          segment={segment}
          allCategoriesInSegment={allCategoriesInSegment}
          equipmentItems={equipmentList.items}
          totalCount={equipmentList.total}
          filterOptions={filterOptions}
        />
      </>
    );
  }

  // --------------------------------------------------------------------------
  // ROUTE RESOLVER: Case 2: /equipment/[segment]/[category] OR /equipment/[cat]/[model]
  // --------------------------------------------------------------------------
  if (slug.length === 2) {
    const [first, second] = slug;

    // Check if second is an equipment category (e.g. /equipment/awp/boom-lifts)
    const category = await getCategoryBySlug(second);
    if (category) {
      const segment = category.segment;
      const [allCategoriesInSegment, filterOptions, equipmentList] = await Promise.all([
        getEquipmentCategories(segment.slug),
        getAvailableFilters(category.slug, undefined),
        getEquipmentList({
          category: category.slug,
          brand: brandParam,
          subtype: subtypeParam,
          power: powerParam,
          rental: rentalParam || undefined,
          purchase: purchaseParam || undefined,
          query: queryParam,
          sort: sortParam,
          page: pageParam,
          limit: 12,
        }),
      ]);

      const faqs = CATEGORY_FAQS[category.slug] || [];

      const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
        { label: "Equipment", href: "/equipment" },
        { label: segment.name, href: `/equipment/${segment.slug}` },
        { label: category.name, href: `/equipment/${segment.slug}/${category.slug}` },
      ]);

      const itemListJsonLd = buildEquipmentItemListJsonLd(
        `${category.name} Machinery`,
        equipmentList.items.map((m, i) => ({
          name: m.model_name,
          url: `/equipment/${m.category.slug}/${m.slug}`,
          image: m.primary_image_url,
          position: i + 1,
        }))
      );

      const faqJsonLd = faqs.length > 0 ? buildFaqJsonLd(faqs) : null;

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
          />
          {faqJsonLd && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
          )}
          <CategoryListingView
            segment={segment}
            category={category}
            allCategoriesInSegment={allCategoriesInSegment}
            equipmentItems={equipmentList.items}
            totalCount={equipmentList.total}
            filterOptions={filterOptions}
            faqs={faqs}
          />
        </>
      );
    }

    // Check if second is an individual equipment model (e.g. /equipment/boom-lifts/jlg-300ajp)
    const equipment = await getEquipmentBySlug(second);
    if (equipment) {
      const relatedEquipment = await getRelatedEquipment(equipment.id, equipment.category_id, 3);
      const faqs = CATEGORY_FAQS[equipment.category.slug] || [];

      const segmentSlug = equipment.category.segment?.slug || "awp";
      const segmentName = equipment.category.segment?.name || "Aerial Platforms";

      const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
        { label: "Equipment", href: "/equipment" },
        { label: segmentName, href: `/equipment/${segmentSlug}` },
        { label: equipment.category.name, href: `/equipment/${segmentSlug}/${equipment.category.slug}` },
        { label: equipment.model_name },
      ]);

      const productJsonLd = buildProductJsonLd({
        name: equipment.model_name,
        description: equipment.short_description,
        image: equipment.primary_image_url,
        brandName: equipment.brand.name,
        modelNumber: equipment.model_number,
        categoryName: equipment.category.name,
        url: `/equipment/${equipment.category.slug}/${equipment.slug}`,
        rentalAvailable: equipment.rental_available,
        purchaseAvailable: equipment.purchase_available,
      });

      const faqJsonLd = faqs.length > 0 ? buildFaqJsonLd(faqs) : null;

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
          />
          {faqJsonLd && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
          )}
          <EquipmentDetailView
            equipment={equipment}
            relatedEquipment={relatedEquipment}
            faqs={faqs}
          />
        </>
      );
    }

    notFound();
  }

  // --------------------------------------------------------------------------
  // ROUTE RESOLVER: Case 3: /equipment/[segment]/[category]/[model]
  // --------------------------------------------------------------------------
  if (slug.length === 3) {
    const equipment = await getEquipmentBySlug(slug[2]);
    if (!equipment) {
      notFound();
    }

    const relatedEquipment = await getRelatedEquipment(equipment.id, equipment.category_id, 3);
    const faqs = CATEGORY_FAQS[equipment.category.slug] || [];

    const segmentSlug = equipment.category.segment?.slug || "awp";
    const segmentName = equipment.category.segment?.name || "Aerial Platforms";

    const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
      { label: "Equipment", href: "/equipment" },
      { label: segmentName, href: `/equipment/${segmentSlug}` },
      { label: equipment.category.name, href: `/equipment/${segmentSlug}/${equipment.category.slug}` },
      { label: equipment.model_name },
    ]);

    const productJsonLd = buildProductJsonLd({
      name: equipment.model_name,
      description: equipment.short_description,
      image: equipment.primary_image_url,
      brandName: equipment.brand.name,
      modelNumber: equipment.model_number,
      categoryName: equipment.category.name,
      url: `/equipment/${equipment.category.slug}/${equipment.slug}`,
      rentalAvailable: equipment.rental_available,
      purchaseAvailable: equipment.purchase_available,
    });

    const faqJsonLd = faqs.length > 0 ? buildFaqJsonLd(faqs) : null;

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        {faqJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        )}
        <EquipmentDetailView
          equipment={equipment}
          relatedEquipment={relatedEquipment}
          faqs={faqs}
        />
      </>
    );
  }

  notFound();
}
