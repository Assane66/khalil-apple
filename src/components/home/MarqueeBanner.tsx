'use client';

import React from 'react';
import { Truck, ShieldCheck, Zap, CreditCard, Award, RefreshCw, Sparkles } from 'lucide-react';

const REASSURANCE_ITEMS = [
  { icon: Truck, text: 'LIVRAISON EXPRESS 24H À DAKAR & RÉGIONS', color: 'text-amber-400' },
  { icon: ShieldCheck, text: 'GARANTIE 1 MOIS CERTIFIÉE KHALIL APPLE', color: 'text-yellow-300' },
  { icon: Zap, text: 'PROMOTIONS EXCLUSIVES KHALIL APPLE', color: 'text-amber-400' },
  { icon: CreditCard, text: 'PAIEMENT SÉCURISÉ À LA LIVRAISON (CASH / WAVE / OM)', color: 'text-yellow-200' },
  { icon: Award, text: 'PRODUITS APPLE 100% AUTHENTIQUES', color: 'text-amber-300' },
  { icon: RefreshCw, text: 'REPRISE & ÉCHANGE INSTANTANÉ AVEC IA', color: 'text-yellow-400' },
];

export function MarqueeBanner() {
  return (
    <div className="relative flex h-14 min-h-14 w-full items-center overflow-hidden bg-gradient-to-r from-zinc-950 via-black to-zinc-950 border-y border-amber-500/20 shadow-2xl">
      {/* Ambient glowing edge gradients */}
      <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* Infinite Marquee Track */}
      <div className="animate-marquee flex items-center gap-12 whitespace-nowrap">
        {[...REASSURANCE_ITEMS, ...REASSURANCE_ITEMS].map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div key={idx} className="inline-flex items-center gap-3 group cursor-pointer">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
                <IconComponent className="w-3.5 h-3.5" />
              </span>

              <span className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-zinc-200 group-hover:text-amber-300 transition-colors">
                {item.text}
              </span>

              <Sparkles className="w-3 h-3 text-amber-500/50 ml-2" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
