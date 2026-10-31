import { NextResponse } from "next/server";
import { getEquipmentCategories, getEquipmentList, getEquipmentBrands } from "@/lib/queries/equipment";

export const revalidate = 86400; // 24 hours

export async function GET() {
  try {
    const [categories, brandsRes, equipmentRes] = await Promise.all([
      getEquipmentCategories(),
      getEquipmentBrands(),
      getEquipmentList({ limit: 48 }),
    ]);

    const baseUrl = "https://www.reachinternational.co.in";

    let content = `# Reach International Equipment Catalogue (llms.txt)
> Reaching All Heights — Professional Aerial Work Platforms (AWP) and Material Handling Equipment (MHE) for rental and purchase across India.

## About Reach International
Reach International is India's premier provider of certified heavy access platforms, boom lifts, scissor lifts, and industrial material handling equipment. We partner directly with leading global OEMs including JLG, Genie, JCB, Toyota, Hyundai, and BYD.

- Website: ${baseUrl}
- Equipment Directory: ${baseUrl}/equipment
- Rental & Purchase Enquiries: ${baseUrl}/equipment#quote-assistance

---

## Equipment Segments & Categories

### Aerial Work Platforms (AWP)
Equipment for elevated access, working at heights, industrial plant maintenance, and construction.
`;

    for (const cat of categories.filter((c) => c.segment.slug === "awp")) {
      content += `- [${cat.name}](${baseUrl}/equipment/awp/${cat.slug}): ${cat.description || "Aerial access equipment."} (${cat.models_count} published models)\n`;
    }

    content += `\n### Material Handling Equipment (MHE)
Equipment for lifting, transporting, pallet handling, and high-density warehouse storage.
`;

    for (const cat of categories.filter((c) => c.segment.slug === "mhe")) {
      content += `- [${cat.name}](${baseUrl}/equipment/mhe/${cat.slug}): ${cat.description || "Material handling solutions."} (${cat.models_count} published models)\n`;
    }

    content += `\n---

## Authorized OEM Partner Brands
`;

    for (const b of brandsRes) {
      content += `- **${b.name}**: ${b.models_count} machine models available across India.\n`;
    }

    content += `\n---

## Published Equipment Inventory

`;

    for (const m of equipmentRes.items) {
      content += `### ${m.model_name}
- **Brand**: ${m.brand.name}
- **Model Number**: ${m.model_number}
- **Category**: ${m.category.name} (${m.subtype || "Standard"})
- **Working Height / Lift Height**: ${m.primary_working_height || "N/A"}
- **Lifting Capacity**: ${m.primary_capacity || "N/A"}
- **Power Source**: ${m.primary_power_source || "N/A"}
- **Availability**: ${m.rental_available ? "Rental" : ""}${m.rental_available && m.purchase_available ? " & " : ""}${m.purchase_available ? "Purchase" : ""}
- **Description**: ${m.short_description}
- **URL**: ${baseUrl}/equipment/${m.category.slug}/${m.slug}

`;
    }

    content += `---
## Customer Assistance & Custom Quotation
For specialized working height requirements, customized site leases, or purchase inquiries:
- Form: ${baseUrl}/equipment#quote-assistance
- Response Time: Under 2 hours across India
`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    console.error("[llms.txt] Error generating content:", error);
    return new NextResponse("# Reach International Equipment Catalogue\nExplore machinery at https://www.reachinternational.co.in/equipment", {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
}
