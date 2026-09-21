'use client';

import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { useState, useEffect } from "react";
import { splitPhoneNumbers } from "@/lib/phone-utils";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";

interface SettingsData {
  shopName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
}

async function getSettings(): Promise<SettingsData> {
    try {
        const settingsRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            return docSnap.data() as SettingsData;
        }
        return {};
    } catch (error) {
        console.error("Failed to fetch settings for footer:", error);
        return {};
    }
}

export function Footer() {
  const [settings, setSettings] = useState<SettingsData>({});

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const shopName = settings.shopName || 'Khalil Apple';
  const address = settings.address || 'Tivaouane Peulh';
  const contactPhones = splitPhoneNumbers(settings.contactPhone || '+221781395893');
  const contactEmail = settings.contactEmail || 'baalhassane521@gmail.com';
  const facebookUrl = settings.facebookUrl;
  const instagramUrl = settings.instagramUrl;
  const tiktokUrl = settings.tiktokUrl || 'https://vm.tiktok.com/ZMHgBjJwjqgsS-ysH6R/';

  return (
    <footer className="relative bg-secondary/30 border-t border-border/50">
      {/* Gold top divider */}
      <div className="gold-divider" />

      <div className="container py-14 px-4 md:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">

          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <Image
                src={getOptimizedImageUrl("https://res.cloudinary.com/dm6yuokre/image/upload/v1752163215/IMG-20250710-WA0000-removebg-preview_uunwq2.png", 64)}
                alt="Khalil Apple Logo"
                width={32}
                height={32}
                className="h-8 w-8 transition-transform duration-300 group-hover:scale-110"
              />
              <span className="font-headline font-bold text-xl gold-text" translate="no">{shopName}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Votre expert iPhone au Sénégal.<br />Qualité, authenticité et service garantis.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h4 className="font-headline font-semibold text-sm tracking-widest uppercase text-muted-foreground">Navigation</h4>
            <ul className="space-y-2">
              {[
                { href: '/exchange', label: 'Échange' },
                { href: '/products', label: 'Nos Produits' },
                { href: '/about', label: 'Qui sommes-nous ?' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2 group"
                  >
                    <span className="h-px w-4 bg-primary/0 group-hover:bg-primary transition-all duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-headline font-semibold text-sm tracking-widest uppercase text-muted-foreground">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{address}</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex flex-col gap-1">
                  {contactPhones.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone}`}
                      className="text-muted-foreground hover:text-primary transition-colors duration-200"
                    >
                      {phone}
                    </a>
                  ))}
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-muted-foreground hover:text-primary transition-colors duration-200 break-all"
                >
                  {contactEmail}
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="font-headline font-semibold text-sm tracking-widest uppercase text-muted-foreground">Suivez-nous</h4>
            <div className="flex items-center gap-3">
              <Link
                href={facebookUrl || 'https://facebook.com'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary border border-border hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 text-muted-foreground hover:text-primary"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                </svg>
              </Link>
              <Link
                href={instagramUrl || 'https://instagram.com'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary border border-border hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 text-muted-foreground hover:text-primary"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </Link>
              <Link
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary border border-border hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 text-muted-foreground hover:text-primary"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.96a8.17 8.17 0 004.78 1.52V7.01a4.85 4.85 0 01-1.01-.32z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} <span className="gold-text font-semibold" translate="no">{shopName}</span>. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Qualité • Authenticité • Excellence
          </p>
        </div>
      </div>
    </footer>
  );
}
