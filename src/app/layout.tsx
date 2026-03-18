import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FluxStudio - Open-Source Image Generation Studio',
  description: 'Professional image generation with node graphs, ControlNet, model management, and LoRA training.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
