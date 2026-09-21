'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getOptimizedImageUrl } from '@/lib/image-optimizer';

const IPhone3DViewer = dynamic(
  () => import('@/components/3d/IPhone3DViewer').then((module) => module.IPhone3DViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] w-full items-center justify-center md:h-[540px]">
        <div className="h-64 w-64 animate-pulse rounded-full border border-white/5 bg-zinc-900/50" />
      </div>
    ),
  }
);

type HeroMediaProps = {
  onBuyClick: () => void;
  modelUrl?: string;
  mediaType?: '3d' | 'image';
  imageUrl?: string;
  title?: string;
};

export function HeroMedia({ onBuyClick, modelUrl, mediaType, imageUrl, title }: HeroMediaProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isTouchViewport = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const useMobileImage = isTouchViewport || isTouchDevice;

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  if (useMobileImage) {
    return (
      <div className="relative mx-auto flex h-[440px] w-full max-w-xl items-center justify-center md:h-[540px]">
        <Image
          src={getOptimizedImageUrl(imageUrl, 550)}
          alt={title || 'Produit phare'}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 550px"
          className="object-contain drop-shadow-[0_25px_50px_rgba(245,158,11,0.25)]"
        />
      </div>
    );
  }

  return (
    <IPhone3DViewer
      onBuyClick={onBuyClick}
      modelUrl={modelUrl}
      mediaType={mediaType}
      imageUrl={imageUrl}
      title={title}
    />
  );
}
