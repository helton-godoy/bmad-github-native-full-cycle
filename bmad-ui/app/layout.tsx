import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BMAD Orchestration Hub',
  description: 'Real-time monitoring dashboard for AI agent orchestration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
