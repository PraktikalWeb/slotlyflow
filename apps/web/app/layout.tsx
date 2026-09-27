import type { Metadata } from "next";
import { Spline_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-spline-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "SlotlyFlow UI Lab",
  description: "Disconnected frontend prototype for SlotlyFlow",
  icons: {
    // Transparent, square-cropped favicon derived from docs/icon.png.
    icon: '/brand/slotlyflow-favicon.png',
    apple: '/brand/slotlyflow-favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${splineSans.variable} ${ibmPlexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
