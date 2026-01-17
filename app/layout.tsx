import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import BackgroundOrb from "@/components/BackgroundOrb";

export const metadata: Metadata = {
  title: "Trippy - Collaborative Trip Planning",
  description: "Plan trips together with your group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <BackgroundOrb />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}