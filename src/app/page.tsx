// src/app/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, Clock, ChevronRight, Shield, Zap, Sparkles, Star, ArrowRight, CheckCircle2, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, DocumentData, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Product, FeaturedSlots, HeroConfig } from '@/types';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';

import { MagneticButton } from '@/components/ui/MagneticButton';
import { HeroMedia } from '@/components/home/HeroMedia';
import { BentoGridSection } from '@/components/home/BentoGridSection';
import { MarqueeBanner } from '@/components/home/MarqueeBanner';
import { FlipClockTimer } from '@/components/home/FlipClockTimer';
import { FastCheckoutDrawer } from '@/components/checkout/FastCheckoutDrawer';
import { cn } from '@/lib/utils';
import { getOptimizedImageUrl } from '@/lib/image-optimizer';
import { getCachedHomePageData, setCachedHomePageData } from '@/lib/product-cache';

/* ─── Data fetching ──────────────────────────────── */
async function getHomePageData() {
  try {
    const [bannerSnap, catSnap, prodSnap, promoSnap, settingsSnap, invSnap, flashSnap] = await Promise.all([
      getDocs(query(collection(db, 'banners'), where('status', '==', 'Actif'))),
      getDocs(query(collection(db, 'categories'), orderBy('name', 'asc'))),
      getDocs(collection(db, 'products')),
      getDocs(query(collection(db, 'promotions'), where('endDate', '>', Timestamp.now()))),
      getDoc(doc(db, 'settings', 'general')),
      getDocs(query(collection(db, 'inventory'), where('status', '==', 'disponible'))),
      getDocs(query(collection(db, 'flashSales'), where('status', '==', 'Actif'))).catch(() => ({ docs: [] } as any)),
    ]);

    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const promotions: any[] = promoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const availableInventory: any[] = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const flashSalesList = flashSnap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .filter((f: any) => {
        if (!f.endDate) return true;
        const endMillis = f.endDate.toMillis ? f.endDate.toMillis() : new Date(f.endDate).getTime();
        return endMillis > Date.now();
      });

    let rawProductList = prodSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Product))
      .filter(p => p.status === 'active' || (p.status as string) === 'Actif');

    let productList = rawProductList.map(p => {
      // Promotions
      const matchingPromos = promotions.filter(promo => {
        if (promo.status === 'Inactif') return false;
        if (promo.endDate && promo.endDate.toMillis && promo.endDate.toMillis() <= Date.now()) return false;

        if (promo.targetType === 'all') return true;
        if (promo.targetType === 'category' && promo.targetCategories?.includes(p.categoryId)) return true;
        if (promo.targetType === 'products' && promo.targetProducts?.includes(p.id)) return true;
        if (promo.productId === p.id) return true;
        return false;
      });

      if (matchingPromos.length > 0) {
        const activePromo = matchingPromos[0];
        p.promoEndDate = activePromo.endDate;
        const discount = Number(activePromo.discountAmount) || 0;

        p.variants = p.variants?.map(v => {
          if (discount > 0) {
            const promoPrice = Math.max(0, v.price - discount);
            return { ...v, isPromo: true, promoPrice, originalPrice: v.price };
          } else if (activePromo.variantStorage === v.storage && activePromo.discountPrice) {
            return { ...v, isPromo: true, promoPrice: activePromo.discountPrice, originalPrice: v.price };
          }
          return v;
        }) || [];
      }

      // 1. Stock physique disponible réel (SANS JAMAIS EXPOSER L'IMEI STRICTEMENT CONFIDENTIEL)
      const matchingInv = availableInventory.filter(inv => 
        inv.productId === p.id || 
        (inv.productName && p.name && inv.productName.trim().toLowerCase() === p.name.trim().toLowerCase())
      );

      const inStockCount = matchingInv.length;
      p.inStock = inStockCount > 0;
      p.inStockCount = inStockCount;

      if (p.inStock) {
        // Détecter l'état dominant en stock si non spécifié sur le produit
        const hasVenant = matchingInv.some(i => i.isVenant);
        const hasSecondHand = matchingInv.some(i => i.isSecondHand);
        if (hasVenant) p.isVenant = true;
        if (hasSecondHand && !hasVenant) p.isSecondHand = true;

        // Construire les variantes de stock par stockage (pour le checkout drawer)
        const stockByStorage = new Map();
        matchingInv.forEach((i: any) => {
          if (i.storage) {
            const p2 = i.unitPrice || i.sellingPrice || 0;
            if (!stockByStorage.has(i.storage) || p2 < (stockByStorage.get(i.storage) || 0)) {
              stockByStorage.set(i.storage, p2);
            }
          }
        });
        if (stockByStorage.size > 0) {
          (p as any).stockVariants = Array.from(stockByStorage.entries()).map(([storage, price]: [string, number]) => ({
            storage, price, promoPrice: undefined,
          }));
          const firstStorage = matchingInv.find((i: any) => i.storage)?.storage;
          if (firstStorage) (p as any).stockStorage = firstStorage;
        }

        // Si une unité a un prix personnalisé inférieur
        const customItems = matchingInv.filter((i: any) => i.unitPrice && i.unitPrice > 0);
        if (customItems.length > 0) {
          const lowestCustom = Math.min(...customItems.map((i: any) => i.unitPrice));
          p.unitPrice = lowestCustom;
          p.originalPrice = customItems[0].originalPrice || customItems[0].catalogPrice || p.variants?.[0]?.price;
        }
      }


      // Nettoyer strictement toute trace d'IMEI pour les visiteurs
      delete (p as any).imei;
      delete (p as any).hasIMEI;

      return p;
    });

    // Règle d'or : On NE SUPPRIME AUCUN PRODUIT du catalogue !
    // Mais on donne la priorité d'affichage aux modèles disponibles en stock réel (inStock === true)
    productList.sort((a, b) => {
      const aStock = a.inStock ? 1 : 0;
      const bStock = b.inStock ? 1 : 0;
      if (bStock !== aStock) return bStock - aStock;
      return 0;
    });

    const bannerList = bannerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const categoryList = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activePromo = promotions.length > 0 ? promotions[0] : null;
    const contactPhone = settings.contactPhone || '221770000000';
    const whatsappNumber = settings.whatsappNumber || contactPhone.split('/')[0];
    const featuredSlots = settings.featuredSlots || null;
    const heroConfig = settings.heroConfig || null;

    const result = {
      bannerList,
      categoryList,
      productList,
      activePromo,
      flashSalesList,
      contactPhone,
      whatsappNumber,
      featuredSlots,
      heroConfig,
    };

    setCachedHomePageData(result);
    return result;
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    return { bannerList: [], categoryList: [], productList: [], activePromo: null, flashSalesList: [], contactPhone: '221770000000', whatsappNumber: '221770000000', featuredSlots: null, heroConfig: null };
  }
}

/* ─── Scroll Reveal Hook ─────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal, .reveal-scale').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─── Main Page ──────────────────────────────────── */
export default function Home() {
  const [banners, setBanners] = useState<DocumentData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<DocumentData[]>([]);
  const [activePromo, setActivePromo] = useState<DocumentData | null>(null);
  const [flashSales, setFlashSales] = useState<DocumentData[]>([]);
  const [contactPhone, setContactPhone] = useState('221770000000');
  const [whatsappNumber, setWhatsappNumber] = useState('221770000000');
  const [featuredSlots, setFeaturedSlots] = useState<FeaturedSlots | undefined>(undefined);
  const [heroConfig, setHeroConfig] = useState<HeroConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(6);
  const [showAllFlashSales, setShowAllFlashSales] = useState(false);

  // Fast Checkout Drawer State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCheckoutProduct, setSelectedCheckoutProduct] = useState<{
    name: string;
    price: string;
    storage: string;
    image?: string;
    variants?: any[];
  }>({
    name: 'iPhone 17 Pro Max',
    price: '890 000',
    storage: '256 GB',
  });

  useScrollReveal();

  useEffect(() => {
    // 1. Affichage immédiat depuis le cache local (0 ms)
    const cached = getCachedHomePageData();
    if (cached && cached.productList && cached.productList.length > 0) {
      setBanners(cached.bannerList || []);
      setCategories(cached.categoryList || []);
      setProducts(cached.productList || []);
      setActivePromo(cached.activePromo || null);
      setFlashSales(cached.flashSalesList || []);
      setContactPhone(cached.contactPhone || '221770000000');
      setWhatsappNumber(cached.whatsappNumber || cached.contactPhone?.split('/')[0] || '221770000000');
      if (cached.featuredSlots) setFeaturedSlots(cached.featuredSlots);
      setIsLoading(false);
    }

    // 2. Synchronisation transparente en arrière-plan
    const fetchData = async () => {
      const data = await getHomePageData();
      setBanners(data.bannerList);
      setCategories(data.categoryList);
      setProducts(data.productList);
      setActivePromo(data.activePromo);
      setFlashSales(data.flashSalesList || []);
      setContactPhone(data.contactPhone);
      setWhatsappNumber(data.whatsappNumber || data.contactPhone.split('/')[0]);
      if (data.featuredSlots) setFeaturedSlots(data.featuredSlots);
      setHeroConfig(data.heroConfig);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.keywords && p.keywords.join(' ').toLowerCase().includes(term))
      );
    }
    if (selectedCategory !== 'all') list = list.filter(p => p.categoryId === selectedCategory);
    
    // Priorité absolue : modèles avec stock disponible affichés en premier
    return [...list].sort((a, b) => {
      const aStock = a.inStock ? 1 : 0;
      const bStock = b.inStock ? 1 : 0;
      if (bStock !== aStock) return bStock - aStock;
      return 0;
    });
  }, [products, searchTerm, selectedCategory]);

  const getLowestPrice = useCallback((variants: Product['variants'] = []) => {
    const prices = variants.map(v => v.promoPrice || v.price).filter(p => p > 0);
    if (!prices.length) return '890 000';
    return Math.min(...prices).toLocaleString('fr-FR');
  }, []);

  const getPromoDetails = useCallback((variants: Product['variants'] = []) => {
      if (!variants) return null;
      const promoVariant = variants.find(v => v.isPromo && v.promoPrice && v.originalPrice);
      if (!promoVariant || !promoVariant.originalPrice || !promoVariant.promoPrice) return null;

      const discountPercentage = Math.round(((promoVariant.originalPrice - promoVariant.promoPrice) / promoVariant.originalPrice) * 100);
      return {
        promoPrice: promoVariant.promoPrice.toLocaleString('fr-FR'),
        originalPrice: promoVariant.originalPrice.toLocaleString('fr-FR'),
        discountPercentage
      };
  }, []);

  const handleOpenCheckout = (name: string, price: string, storage: string, image?: string, variants?: any[]) => {
    setSelectedCheckoutProduct({ name, price, storage, image, variants });
    setIsCheckoutOpen(true);
  };

  // ── Configuration Hero Dynamique (ou valeurs par défaut) ──
  const heroBadge = heroConfig?.badge || "";
  const heroTitle = heroConfig?.title || "";
  const heroSubtitle = heroConfig?.subtitle || "";
  const heroDescription = heroConfig?.description || "";
  const heroBtnText = heroConfig?.buttonText || "";
  const heroBtnPrice = heroConfig?.buttonPrice || "";
  const heroBtnStorage = heroConfig?.buttonStorage || "";
  const heroStat1Value = heroConfig?.stat1Value || "";
  const heroStat1Label = heroConfig?.stat1Label || "";
  const heroStat2Value = heroConfig?.stat2Value || "";
  const heroStat2Label = heroConfig?.stat2Label || "";
  const heroStat3Value = heroConfig?.stat3Value || "";
  const heroStat3Label = heroConfig?.stat3Label || "";

  // Produit lié s'il est spécifié dans la config
  const heroLinkedProduct = useMemo(() => {
    if (!heroConfig?.productId) return null;
    return products.find(p => p.id === heroConfig.productId) || null;
  }, [heroConfig?.productId, products]);

  const handleHeroCheckout = () => {
    if (heroLinkedProduct) {
      const price = heroLinkedProduct.variants?.length
        ? Math.min(...heroLinkedProduct.variants.map(v => v.promoPrice || v.price)).toLocaleString('fr-FR')
        : heroBtnPrice;
      const storage = heroLinkedProduct.variants?.[0]?.storage || heroBtnStorage;
      handleOpenCheckout(
        heroLinkedProduct.name,
        price,
        storage,
        heroLinkedProduct.thumbnail,
        heroLinkedProduct.variants
      );
    } else {
      handleOpenCheckout(
        heroTitle.replace(/\.$/, ''),
        heroBtnPrice,
        heroBtnStorage,
        heroConfig?.imageUrl
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative bg-black text-foreground overflow-x-hidden">

      {/* ═══ LUXURY AMBIENT BACKGROUND GLOW ORBS ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="orb w-[700px] h-[700px] bg-amber-500/15"
          style={{ top: '-250px', right: '-200px', animation: 'floatYSlow 16s ease-in-out infinite' }}
        />
        <div
          className="orb w-[600px] h-[600px] bg-amber-600/10"
          style={{ bottom: '15%', left: '-250px', animation: 'floatYSlow 20s ease-in-out infinite reverse' }}
        />
      </div>

      {/* ═══ 1. HERO SECTION : 3D IPHONE + TYPOGRAPHY + MAGNETIC CTA ═══ */}
      {heroConfig ? (
      <section className="relative z-10 pt-8 pb-16 md:pt-16 md:pb-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">

            {/* Apple Intelligence / Excellence Badge */}
            {heroBadge && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase tracking-widest animate-fadeInUp">
                <Sparkles className="w-3.5 h-3.5" />
                {heroBadge}
              </div>
            )}

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              {heroTitle}<br />
              <span className="gold-text">{heroSubtitle}</span>
            </h1>

            {/* Sub-description */}
            <p className="text-muted-foreground text-base md:text-xl max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {heroDescription}
            </p>

            {/* Interactive Magnetic CTA Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <MagneticButton
                onClick={handleHeroCheckout}
                badge="LIVRAISON 24H"
              >
                {heroBtnText}
              </MagneticButton>

              <Link
                href="/exchange"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold text-zinc-300 hover:text-white transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                Échanger mon Ancien iPhone
              </Link>
            </div>

            {/* Key Trust Signals */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/10 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              <div>
                <p className="text-lg md:text-xl font-extrabold text-amber-400">{heroStat1Value}</p>
                <p className="text-[11px] text-zinc-400 uppercase font-semibold">{heroStat1Label}</p>
              </div>
              <div>
                <p className="text-lg md:text-xl font-extrabold text-amber-400">{heroStat2Value}</p>
                <p className="text-[11px] text-zinc-400 uppercase font-semibold">{heroStat2Label}</p>
              </div>
              <div>
                <p className="text-lg md:text-xl font-extrabold text-amber-400">{heroStat3Value}</p>
                <p className="text-[11px] text-zinc-400 uppercase font-semibold">{heroStat3Label}</p>
              </div>
            </div>
          </div>

          {/* Right 3D Interactive iPhone Model or High-Res Image */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <HeroMedia
              onBuyClick={handleHeroCheckout}
              modelUrl={heroConfig?.modelUrl}
              mediaType={heroConfig?.mediaType}
              imageUrl={heroConfig?.imageUrl || heroLinkedProduct?.thumbnail}
              title={heroTitle}
            />
          </div>
        </div>
      </section>
      ) : (
        <section
          aria-label="Chargement de la vitrine"
          className="relative z-10 min-h-[620px] max-w-7xl mx-auto w-full animate-pulse"
        />
      )}

      {/* ═══ 2. INFINITE MARQUEE REASSURANCE BANNER ═══ */}
      <section className="relative z-10 my-4">
        <MarqueeBanner />
      </section>

      {/* ═══ 3. VENTE FLASH (Affiché UNIQUEMENT si des ventes flash actives existent) ═══ */}
      {flashSales.length > 0 && (
        <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
          <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-r from-red-950/40 via-zinc-950 to-amber-950/30 border border-red-500/30 backdrop-blur-xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-red-400" />
                  Ventes Flash Limitées
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                  Offres Exceptionnelles en Temps Réel
                </h2>
              </div>
              {/* Afficher le bouton uniquement s'il y a plus de 3 ventes flash */}
              {flashSales.length > 3 && (
                <button 
                  onClick={() => setShowAllFlashSales(prev => !prev)}
                  className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  {showAllFlashSales ? "Réduire les ventes flash" : `Voir les autres ventes flash (${flashSales.length})`}
                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showAllFlashSales ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(showAllFlashSales ? flashSales : flashSales.slice(0, 3)).map((sale: any) => {
                const targetSlug = sale.slug || sale.id;
                const saleUrl = `/flash-sale/${targetSlug}`;
                const salePrice = sale.discountPrice || sale.variants?.[0]?.discountPrice || 0;
                const origPrice = sale.originalPrice || sale.variants?.[0]?.originalPrice || 0;

                return (
                  <Link
                    key={sale.id}
                    href={saleUrl}
                    className="group p-4 rounded-2xl bg-black/60 border border-white/10 hover:border-red-500/60 hover:bg-zinc-950/80 hover:shadow-lg hover:shadow-red-500/10 transition-all flex items-center gap-4 cursor-pointer"
                  >
                    {sale.thumbnail && (
                      <div className="relative w-20 h-20 rounded-xl bg-zinc-900/80 flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                        <Image
                          src={getOptimizedImageUrl(sale.thumbnail, 200)}
                          alt={sale.productName || 'Vente flash'}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                    )}
                    <div className="flex-grow min-w-0 space-y-1">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Flash</span>
                      <h4 className="font-extrabold text-sm text-white truncate group-hover:text-red-300 transition-colors">{sale.productName}</h4>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-amber-400 font-extrabold text-base">
                          {Number(salePrice).toLocaleString('fr-FR')} CFA
                        </span>
                        {origPrice > salePrice && (
                          <span className="text-[11px] text-zinc-500 line-through">
                            {Number(origPrice).toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 group-hover:translate-x-1 transition-transform pt-1">
                        <span>En profiter</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 4. PROMO (Affiché UNIQUEMENT si une promotion active existe) ═══ */}
      {activePromo && (
        <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
          {(() => {
            const promoTitle = activePromo.title || "OFFRE PROMOTIONNELLE EXCLUSIVE";
            const promoDiscount = activePromo.discountAmount ? `- ${activePromo.discountAmount} CFA` : 'Réductions exceptionnelles';
            const promoTargetText = activePromo.targetType === 'all' ? 'sur tous nos produits' : 'sur notre sélection';
            const promoSubtitle = `${promoDiscount} ${promoTargetText}`;
            const promoEndDate = activePromo.endDate ? (typeof activePromo.endDate.toMillis === 'function' ? activePromo.endDate.toMillis() : new Date(activePromo.endDate).getTime()) : undefined;

            return (
              <FlipClockTimer title={promoTitle} subtitle={promoSubtitle} targetDate={promoEndDate} />
            );
          })()}
        </section>
      )}

      {/* ═══ 5. APPLE DESIGN BENTO GRID (Produits Vedettes) ═══ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-12 w-full">
        <BentoGridSection
          products={products}
          featuredSlots={featuredSlots}
          onQuickBuy={(name, price, storage, variants) => handleOpenCheckout(name, price, storage, undefined, variants)}
        />
      </section>

      {/* ═══ 6. CATALOGUE FILTER & SEARCH SECTION (Tous les modèles, disponibles en premier) ═══ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-12 w-full space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="section-label">Catalogue Khalil Apple</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Tous nos <span className="gold-text">iPhones du Catalogue</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Modèles en stock immédiat priorisés en premier, ainsi que tous les modèles disponibles à la commande.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="product-search"
              placeholder="Rechercher un modèle..."
              className="pl-11 h-12 rounded-full border-white/10 bg-zinc-900/90 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[{ id: 'all', name: 'Tous les modèles' }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 flex-shrink-0',
                selectedCategory === cat.id
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-3xl bg-zinc-900/60 animate-pulse border border-white/5" />
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-base font-semibold">Aucun iPhone ne correspond à votre recherche.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                className="mt-3 text-xs text-amber-400 hover:underline font-bold"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              {filteredProducts.slice(0, visibleCount).map((product, idx) => {
                const storageDisplay = product.storage || product.variants?.[0]?.storage;
                const productUrl = `/products/${product.slug || product.id}`;
                const initialPrice = product.originalPrice || product.variants?.[0]?.originalPrice || 0;
                const currentPrice = product.unitPrice || product.variants?.[0]?.promoPrice || product.variants?.[0]?.price || 0;

                return (
                  <div
                    key={product.id}
                    className="group relative rounded-3xl p-5 bg-zinc-950/80 border border-white/10 hover:border-amber-500/40 transition-all duration-500 flex items-center gap-4 overflow-hidden"
                  >
                    {/* Product Image (clickable) */}
                    <Link href={productUrl} className="relative w-24 h-28 rounded-2xl bg-zinc-900 flex-shrink-0 overflow-hidden block">
                      <Image
                        src={getOptimizedImageUrl(product.thumbnail, 300)}
                        alt={product.name}
                        fill
                        priority={idx < 4}
                        loading={idx < 4 ? undefined : "lazy"}
                        decoding="async"
                        sizes="(max-width: 768px) 100px, 120px"
                        className="object-contain p-2 group-hover:scale-110 transition-transform duration-500"
                      />
                    </Link>

                    {/* Info */}
                    <div className="flex-grow min-w-0 space-y-1.5">
                      {/* Badges row: En stock / Custom Badge / Venant / 2ème main / Mémoire */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {product.inStock ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ✓ En stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5 text-[10px] font-medium">
                            Sur commande
                          </span>
                        )}

                        {product.customBadge && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-extrabold uppercase tracking-wider">
                            {product.customBadge}
                          </span>
                        )}

                        {product.isVenant && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                            ✦ Venant
                          </span>
                        )}

                        {product.isSecondHand && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 border border-white/10 text-[10px] font-extrabold uppercase tracking-wider">
                            2ème main
                          </span>
                        )}

                        {storageDisplay && (
                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono font-bold text-zinc-300 border border-white/10">
                            {storageDisplay}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-base leading-tight truncate text-foreground group-hover:text-amber-300 transition-colors">
                        <Link href={productUrl}>
                          {product.name}
                        </Link>
                      </h3>
                      
                      {/* Price display with strict Venant vs 2ème main rules */}
                      {(() => {
                        const isLower = initialPrice > 0 && currentPrice < initialPrice;

                        if (isLower) {
                          if (product.isVenant) {
                            // Venant : Prix initial BARRÉ + Nouveau prix
                            return (
                              <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-amber-400 font-extrabold text-xl">
                                    {currentPrice.toLocaleString('fr-FR')}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-400">CFA</span>
                                </div>
                                <span className="text-xs font-bold text-zinc-500 line-through">
                                  {initialPrice.toLocaleString('fr-FR')} CFA
                                </span>
                              </div>
                            );
                          } else if (product.isSecondHand) {
                            // 2ème main : UNIQUEMENT le nouveau prix (JAMAIS de prix barré)
                            return (
                              <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-amber-400 font-extrabold text-xl">
                                    {currentPrice.toLocaleString('fr-FR')}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-400">CFA</span>
                                </div>
                              </div>
                            );
                          }
                        }

                        // Promo standard sur produit catalogue
                        const promoDetails = getPromoDetails(product.variants);
                        if (promoDetails) {
                          return (
                            <div className="flex flex-col">
                              <div className="flex items-baseline gap-1">
                                <span className="text-amber-400 font-extrabold text-xl">{promoDetails.promoPrice}</span>
                                <span className="text-xs font-bold text-zinc-400">CFA</span>
                              </div>
                              <span className="text-xs font-bold text-zinc-500 line-through">{promoDetails.originalPrice} CFA</span>
                            </div>
                          );
                        }

                        // Prix standard
                        const displayPrice = currentPrice > 0 
                          ? currentPrice.toLocaleString('fr-FR') 
                          : getLowestPrice(product.variants);

                        return (
                          <div className="flex items-baseline gap-1">
                            <span className="text-amber-400 font-extrabold text-xl">{displayPrice}</span>
                            <span className="text-xs font-bold text-zinc-400">CFA</span>
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            // Priorité : variantes de stock (stockage réel + prix stock)
                            // Sinon : variantes catalogue standard
                            const stockStorage = (product as any).stockStorage || storageDisplay || '256 GB';
                            const stockVariants = (product as any).stockVariants?.length > 0
                              ? (product as any).stockVariants
                              : product.variants;
                            handleOpenCheckout(
                              product.name,
                              currentPrice > 0 ? currentPrice.toLocaleString('fr-FR') : getLowestPrice(product.variants),
                              stockStorage,
                              product.thumbnail,
                              stockVariants
                            );
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-amber-400 text-black hover:bg-amber-300 font-bold text-[11px] uppercase tracking-wider transition-colors"
                        >
                          Achat 1-Clic
                        </button>
                        <Link
                          href={productUrl}
                          className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-0.5 transition-colors"
                        >
                          Fiche <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Load More Button */}
        {filteredProducts.length > visibleCount && (
          <div className="flex justify-center pt-6 pb-2">
            <Button
              onClick={() => setVisibleCount(prev => prev + 6)}
              variant="outline"
              className="rounded-full px-8 py-6 border-white/10 bg-zinc-900/50 hover:bg-white/10 font-bold"
            >
              Afficher plus de modèles
            </Button>
          </div>
        )}
      </section>

      {/* ═══ FAST CHECKOUT GLASSMORPHISM DRAWER ═══ */}
      <FastCheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        productName={selectedCheckoutProduct.name}
        price={selectedCheckoutProduct.price}
        storage={selectedCheckoutProduct.storage}
        image={selectedCheckoutProduct.image}
        whatsappNumber={whatsappNumber}
        variants={selectedCheckoutProduct.variants}
      />

    </div>
  );
}
