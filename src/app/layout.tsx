import { outfit } from '@/lib/fonts';
import './globals.css';

import Providers from "./providers";



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900 `}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
