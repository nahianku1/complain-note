import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComplainDesk | ISP Complaint Notes",
  description: "A focused workspace for tracking ISP customer complaints.",
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
