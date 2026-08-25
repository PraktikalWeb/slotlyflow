import type { Metadata } from 'next';
import '@fontsource-variable/spline-sans';

import './globals.css';

export const metadata: Metadata = {
  title: 'SlotlyFlow',
  description: 'WhatsApp automation and customer conversations for growing businesses.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
