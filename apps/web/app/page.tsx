import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/lib/dal";

export const metadata: Metadata = {
  title: "REACH INTERNATIONAL — Reaching All Heights",
  description:
    "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
  keywords: [
    "Reach International",
    "Reaching All Heights",
    "Machine Service Management",
    "Preventive Maintenance Software",
    "Field Service Engineering",
    "Enterprise Asset Management",
    "Industrial Automation",
  ],
  openGraph: {
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
    type: "website",
    siteName: "REACH INTERNATIONAL",
  },
  twitter: {
    card: "summary_large_image",
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
  },
};

export default async function Home() {
  const user = await getCurrentUserOrNull();

  if (user && user.status === "active") {
    if (user.role === "operator") {
      redirect("/operations?tab=entry");
    }
    redirect("/machines");
  }

  redirect("/login");
}