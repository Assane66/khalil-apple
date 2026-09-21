// src/components/layout/header.tsx
'use client';

import Link from "next/link";
import { Menu, User, ShoppingCart, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Image from "next/image";
import { ThemeToggle } from "../theme-toggle";
import { useCart } from "@/context/CartContext";
import { useState, useEffect } from "react";
import { QRScanner } from "../admin/qr-scanner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/phone-utils";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";

export function Header() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { cart } = useCart();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-500",
      isScrolled
        ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-lg shadow-black/10"
        : "bg-background/50 border-b border-transparent"
    )}>
      <div className="container flex h-16 items-center px-4 md:px-6">
        {/* Logo */}
        <div className="mr-auto flex items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src={getOptimizedImageUrl("https://res.cloudinary.com/dm6yuokre/image/upload/v1752163215/IMG-20250710-WA0000-removebg-preview_uunwq2.png", 64)}
              alt="Khalil Apple Logo"
              width={32}
              height={32}
              className="h-8 w-8 transition-transform duration-300 group-hover:scale-110"
            />
            <span className="font-headline font-bold text-xl gold-text tracking-wide" translate="no">
              Khalil Apple
            </span>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8 mr-6">
          {[
            { href: '/products', label: 'Produits' },
            { href: '/exchange', label: 'Échange' },
            { href: '/about', label: 'À Propos' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsScannerOpen(true)}
            className="hover:bg-primary/10 hover:text-primary transition-all duration-200"
          >
            <QrCode className="h-5 w-5" />
            <span className="sr-only">Scanner un iPhone</span>
          </Button>

          <ThemeToggle />

          <Link href="/cart" passHref>
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-primary/10 hover:text-primary transition-all duration-200"
            >
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground animate-pulse-gold">
                  {itemCount}
                </span>
              )}
              <ShoppingCart className="h-5 w-5" />
              <span className="sr-only">Panier</span>
            </Button>
          </Link>

          <Link href="/admin/login">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10 hover:text-primary transition-all duration-200"
            >
              <User className="h-5 w-5" />
              <span className="sr-only">Admin Login</span>
            </Button>
          </Link>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover:bg-primary/10">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-border/50">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col pt-8 space-y-1">
                <div className="mb-6 pb-6 border-b border-border/50">
                  <span className="font-headline font-bold text-xl gold-text">Khalil Apple</span>
                </div>
                {[
                  { href: '/', label: 'Accueil' },
                  { href: '/exchange', label: 'Échange' },
                  { href: '/products', label: 'Produits' },
                  { href: '/about', label: 'Qui sommes-nous' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {isScannerOpen && (
        <QRScanner
          onClose={() => setIsScannerOpen(false)}
          onScan={async (imei) => {
            setIsScannerOpen(false);
            try {
              const cleanImei = normalizeDigits(imei);
              const q = query(collection(db, 'inventory'), where('imei', '==', cleanImei));
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                const stockData = snapshot.docs[0].data();
                const productId = stockData.productId;
                const productSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
                if (!productSnap.empty) {
                  const productData = productSnap.docs[0].data();
                  router.push(`/products/${productData.slug}`);
                  toast({ title: "Produit trouvé !", description: `Redirection vers ${productData.name}` });
                }
              } else {
                toast({ variant: "destructive", title: "Non trouvé", description: `Cet IMEI (${cleanImei || imei}) n'est pas répertorié dans notre stock.` });
              }
            } catch (error) {
              console.error(error);
              toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue lors de la recherche." });
            }
          }}
        />
      )}
    </header>
  );
}
