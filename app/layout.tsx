import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TicketDesk | ISP Ticketing System",
  description: "A focused workspace for tracking ISP customer tickets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
