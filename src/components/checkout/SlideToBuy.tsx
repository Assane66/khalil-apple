'use client';

import React, { useState } from 'react';
import { CheckCircle, ShoppingCart } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SlideToBuyProps {
  onSuccess: () => void;
  text?: string;
  disabled?: boolean;
}

export function SlideToBuy({ onSuccess, text = 'COMMANDER', disabled = false }: SlideToBuyProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleClick = () => {
    if (disabled || isSubmitted) return;
    setIsSubmitted(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#c9a84c', '#f5d78e', '#ffffff'],
    });
    setTimeout(() => {
      onSuccess();
    }, 400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isSubmitted}
      className={`relative w-full h-14 md:h-16 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 text-black flex items-center justify-center gap-2 select-none shadow-xl font-extrabold uppercase tracking-widest text-xs md:text-sm transition-all hover:brightness-110 active:scale-[0.99] ${
        disabled || isSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {isSubmitted ? <CheckCircle className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
      <span>{isSubmitted ? 'COMMANDE ENREGISTRÉE !' : text}</span>
    </button>
  );
}
