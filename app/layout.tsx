import type { Metadata } from "next";
import "./globals.css";
import { SidebarWrapper } from "../components/layout/sidebar-wrapper";

export const metadata: Metadata = {
  title: "Tech Debt Engine | Code Audit Flow",
  description: "Enterprise tech debt and code quality intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0B0F17] flex h-screen overflow-hidden font-sans text-slate-100 antialiased">
        <SidebarWrapper>{children}</SidebarWrapper>
      </body>
    </html>
  );
}
