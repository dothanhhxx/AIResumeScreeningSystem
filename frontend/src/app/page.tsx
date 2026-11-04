import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { LandingPage } from "@/components/landing-page";

// Condensed display face for the landing headlines only; body copy stays in Inter.
const display = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TalentLens | Read every CV. Decide with evidence.",
  description:
    "AI resume screening that checks every CV against your job description and shows the evidence. Your team makes the decision.",
};

export default function HomePage() {
  return <LandingPage displayFont={display.variable} />;
}
