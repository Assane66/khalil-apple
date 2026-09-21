'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Phone, CheckCircle2, Sparkles, Truck, User, Store } from 'lucide-react';
import { SlideToBuy } from './SlideToBuy';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

interface FastCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  price?: string;
  storage?: string;
  image?: string;
  whatsappNumber?: string;
  variants?: { storage: string; price: number; promoPrice?: number }[];
}

export function FastCheckoutDrawer({
  isOpen,
  onClose,
  productName = 'iPhone 17 Pro Max',
  price = '890 000',
  storage = '256 GB',
  image = 'https://res.cloudinary.com/dm6yuokre/image/upload/v1784658568/apple-iphone-17-pro-max-256-go-ecran-69-puce-a19-pro-orange-removebg-preview_vmy8i6.png',
  whatsappNumber = '221770000000',
  variants,
}: FastCheckoutDrawerProps) {
  const [selectedStorage, setSelectedStorage] = useState(storage);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'domicile' | 'retrait'>('domicile');
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [isOrdered, setIsOrdered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger les frais de livraison depuis Firestore
  useEffect(() => {
    const loadDeliveryFee = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (typeof data.deliveryFee === 'number') {
            setDeliveryFee(data.deliveryFee);
          }
        }
      } catch (e) {
        // Valeur par défaut conservée
      }
    };
    if (isOpen) loadDeliveryFee();
  }, [isOpen]);

  const currentVariant = variants?.find(v => v.storage === selectedStorage);
  const basePrice = currentVariant
    ? (currentVariant.promoPrice || currentVariant.price)
    : parseInt((price || '0').replace(/\D/g, ''), 10) || 0;

  const shippingCost = deliveryMethod === 'domicile' ? deliveryFee : 0;
  const totalPrice = basePrice + shippingCost;

  const displayPrice = basePrice.toLocaleString('fr-FR');
  const displayTotal = totalPrice.toLocaleString('fr-FR');

  const storageOptions = variants?.map(v => v.storage) || ['128 GB', '256 GB', '512 GB', '1 TB'];

  const handleOrderSuccess = async () => {
    if (!fullName || !phone) return;
    if (deliveryMethod === 'domicile' && !address) return;
    setIsSubmitting(true);

    try {
      const deliveryLabel = deliveryMethod === 'domicile'
        ? `Livraison à domicile (+${deliveryFee.toLocaleString('fr-FR')} CFA)`
        : 'Retrait en boutique (Gratuit)';

      // Save order to Firestore
      await addDoc(collection(db, 'orders'), {
        customerName: fullName,
        customerPhone: phone,
        customerAddress: deliveryMethod === 'domicile' ? address : 'Retrait en boutique',
        deliveryMethod: deliveryLabel,
        productName: productName,
        storage: selectedStorage,
        price: displayPrice,
        deliveryFee: shippingCost,
        total: totalPrice,
        totalFormatted: `${displayTotal} CFA`,
        status: 'En attente',
        createdAt: serverTimestamp(),
        date: serverTimestamp(),
        items: [
          {
            id: 'fast-checkout-item',
            name: productName,
            storage: selectedStorage,
            quantity: 1,
            price: basePrice,
            thumbnail: image || '',
          }
        ]
      });

      setIsOrdered(true);

      // Format WhatsApp message
      const adresseInfo = deliveryMethod === 'domicile'
        ? `\n- Adresse : ${address}`
        : '\n- Mode : Retrait en boutique';

      const message = `Bonjour Khalil Apple ! Je souhaite commander :\n- Produit : ${productName}\n- Stockage : ${selectedStorage}\n- Prix produit : ${displayPrice} CFA\n- Livraison : ${deliveryMethod === 'domicile' ? `${deliveryFee.toLocaleString('fr-FR')} CFA` : 'Gratuit (retrait)'}\n- Total : ${displayTotal} CFA\n- Client : ${fullName}\n- Téléphone : ${phone}${adresseInfo}`;
      const targetNumber = whatsappNumber.replace(/\+/g, '');
      const whatsappUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 800);
    } catch (error) {
      console.error("Erreur lors de la commande:", error);
      alert("Une erreur est survenue lors de l'enregistrement de votre commande. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Floating Glassmorphism Drawer */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 md:p-8 bg-zinc-950/90 backdrop-blur-2xl border border-white/15 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.9)] text-foreground space-y-6 z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold uppercase tracking-widest text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              Fast Checkout Glassmorphism
            </div>
            <h3 className="text-2xl font-extrabold">Tunnel d'Achat 1-Clic</h3>
            <p className="text-xs text-muted-foreground">
              Validation instantanée par Swipe sans inscription.
            </p>
          </div>

          {/* Order Content */}
          {isOrdered ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="text-2xl font-bold text-emerald-400">Commande Transmise !</h4>
              <p className="text-sm text-zinc-300 max-w-xs mx-auto">
                Redirection vers WhatsApp Khalil Apple pour confirmation de votre livraison.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-wider text-white"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Product preview card */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative w-16 h-16 rounded-xl bg-zinc-900 overflow-hidden flex-shrink-0">
                  <Image src={image} alt={productName} fill className="object-contain p-1" />
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-sm truncate">{productName}</h4>
                  <p className="text-xs text-zinc-400">Garantie 1 Mois Inclus</p>
                  <div className="flex items-baseline gap-1.5 pt-1">
                    <span className="text-lg font-extrabold text-amber-400">{displayPrice}</span>
                    <span className="text-[10px] font-bold text-zinc-400">CFA</span>
                  </div>
                </div>
              </div>

              {/* Storage Capacity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Capacité de Stockage :
                </label>
                <div className="flex flex-wrap gap-2">
                  {storageOptions.map((cap) => (
                    <button
                      key={cap}
                      onClick={() => setSelectedStorage(cap)}
                      className={`flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedStorage === cap
                          ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                          : 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  Mode de livraison :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDeliveryMethod('domicile')}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                      deliveryMethod === 'domicile'
                        ? 'bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-400/20'
                        : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>Domicile</span>
                    <span className={`text-[10px] font-normal ${deliveryMethod === 'domicile' ? 'text-black/70' : 'text-zinc-500'}`}>
                      +{deliveryFee.toLocaleString('fr-FR')} CFA
                    </span>
                  </button>
                  <button
                    onClick={() => setDeliveryMethod('retrait')}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                      deliveryMethod === 'retrait'
                        ? 'bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-400/20'
                        : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <span>Retrait boutique</span>
                    <span className={`text-[10px] font-normal ${deliveryMethod === 'retrait' ? 'text-black/70' : 'text-emerald-400'}`}>
                      Gratuit
                    </span>
                  </button>
                </div>
              </div>

              {/* Customer Express Info */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1 mb-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    Prénom et Nom :
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-zinc-400 text-sm focus:border-amber-400 focus:outline-none transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1 mb-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    Numéro de Téléphone :
                  </label>
                  <input
                    type="tel"
                    placeholder="ex: 77 000 00 00"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-zinc-400 text-sm focus:border-amber-400 focus:outline-none transition-colors font-medium"
                  />
                </div>

                {deliveryMethod === 'domicile' && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      Adresse de Livraison :
                    </label>
                    <input
                      type="text"
                      placeholder="Saisissez votre adresse complète (ex: Sacré-Cœur 3, Dakar)"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-zinc-400 text-sm focus:border-amber-400 focus:outline-none transition-colors font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Total recap */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Produit</span>
                  <span className="font-bold text-white">{displayPrice} CFA</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Livraison</span>
                  <span className={`font-bold ${shippingCost === 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {shippingCost === 0 ? 'Gratuit' : `${shippingCost.toLocaleString('fr-FR')} CFA`}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Total</span>
                  <span className="text-xl font-extrabold text-amber-400">{displayTotal} <span className="text-xs font-bold text-zinc-400">CFA</span></span>
                </div>
              </div>

              {/* Reassurance Note */}
              <div className="flex items-center gap-2 text-[11px] text-amber-300/80 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                <Truck className="w-4 h-4 flex-shrink-0" />
                Paiement sécurisé en espèces ou Wave/OM lors de la livraison.
              </div>

              {/* Simple order action */}
              <div className="pt-2">
                <SlideToBuy 
                  onSuccess={handleOrderSuccess} 
                  text={isSubmitting ? "ENREGISTREMENT..." : "COMMANDER"} 
                  disabled={!fullName || !phone || (deliveryMethod === 'domicile' && !address) || isSubmitting}
                />
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
