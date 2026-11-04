import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { MotionPreference } from "@/components/motion-preference";
import { AuthSessionProvider } from "@/lib/auth-session";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";
import "@/styles/workspace.css";

// Self-hosted variable Inter: weights like 650 render exactly, and Vietnamese
// tone marks use the same face instead of falling back to a system font.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TalentLens | AI Resume Screening",
  description: "A human-centered workspace for reviewing job candidates.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={inter.variable}>
      <body>
        <I18nProvider>
          <MotionPreference />
          <AuthSessionProvider>
            <AppShell>{children}</AppShell>
          </AuthSessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
