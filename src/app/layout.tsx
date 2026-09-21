import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WhatsAppFAB } from '@/components/whatsapp-fab';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Khalil Apple',
  description: 'Boutique premium d\'iPhones au Sénégal avec service d\'échange assisté par IA.',
  icons: [
    {
      rel: 'icon',
      url: 'https://res.cloudinary.com/dm6yuokre/image/upload/v1752163215/IMG-20250710-WA0000-removebg-preview_uunwq2.png',
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-body antialiased`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <CartProvider>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
                <WhatsAppFAB />
              </div>
              <Toaster />
            </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
