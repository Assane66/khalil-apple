// src/components/whatsapp-fab.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { getOptimizedImageUrl } from '@/lib/image-optimizer';

export function WhatsAppFAB() {
  const [whatsappLink, setWhatsappLink] = useState('https://wa.me/221781395893');
  const iconUrl = "https://res.cloudinary.com/dm6yuokre/image/upload/v1752163214/Pngtree_whatsapp_icon_whatsapp_logo_3584844_qnvcmv.png";

  useEffect(() => {
    getDoc(doc(db, 'settings', 'general'))
      .then(settingsSnap => {
        if (!settingsSnap.exists()) return;
        const data = settingsSnap.data();
        const number = normalizePhoneNumber(data.whatsappNumber || String(data.contactPhone || '').split('/')[0]);
        if (number) setWhatsappLink(`https://wa.me/${number}`);
      })
      .catch(error => console.error('Erreur chargement du numéro WhatsApp:', error));
  }, []);

  return (
    <Link href={whatsappLink} target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-5 z-50 h-16 w-16 transition-transform hover:scale-110">
      <Image
        src={getOptimizedImageUrl(iconUrl, 80)}
        alt="Contactez-nous sur WhatsApp"
        width={64}
        height={64}
        className="rounded-full shadow-lg"
      />
    </Link>
  );
}
