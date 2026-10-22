import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AB Ignite",
  description: "Ideas that light the way",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
