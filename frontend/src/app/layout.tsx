import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talent Desk | AI Resume Screening",
  description: "A human-centered workspace for reviewing job candidates.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
