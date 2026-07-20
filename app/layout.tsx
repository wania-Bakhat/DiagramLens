import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Space_Grotesk, Vidaloka } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

const editorial = Vidaloka({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-editorial"
});

export const metadata: Metadata = {
  title: "BioLens | Anatomy atlas and guided study",
  description:
    "BioLens turns textbook anatomy diagrams into a guided atlas with upload extraction, clickable 3D study views, and tutor notes.",
  metadataBase: new URL("http://localhost:3000"),
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${editorial.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
