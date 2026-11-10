import React from 'react';

export const metadata = {
  title: 'AUXANOS — Day-Zero UK Banking for International Students & Skilled Arrivals',
  description:
    'Open your UK GBP Sort Code & Account Number before boarding your flight. Seamless, anti-freeze cross-border corridors for Nigeria (NGN), Ghana (GHS), and Kenya (KES).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#090D16',
          color: '#F8FAFC',
        }}
      >
        {children}
      </body>
    </html>
  );
}
