import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Trifold Global", template: "%s · Trifold Global" },
  description: "Stock, sales and accounts for Trifold Global, distributors of Dangote and Lafarge cement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
