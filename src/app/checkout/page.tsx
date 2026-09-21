// src/app/checkout/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Truck, Store, MapPin, Phone, User, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Le nom est requis.").max(120, "Le nom est trop long."),
  customerPhone: z.string().trim().min(8, "Le numéro de téléphone est requis.").max(30, "Le numéro est trop long."),
  customerAddress: z.string().trim().max(500, "L'adresse est trop longue.").optional(),
  deliveryMethod: z.enum(['delivery', 'pickup'], {
    required_error: "Vous devez sélectionner un mode de livraison."
  }),
}).refine(data => {
  if (data.deliveryMethod === 'delivery' && (!data.customerAddress || data.customerAddress.trim().length < 3)) {
    return false;
  }
  return true;
}, {
  message: "L'adresse de livraison est requise pour une livraison à domicile.",
  path: ["customerAddress"]
});

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('221781395893');
  const [settingsError, setSettingsError] = useState(false);

  // Charger le numéro WhatsApp de la boutique
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.whatsappNumber || data.contactPhone) {
            setWhatsappNumber(String(data.whatsappNumber || String(data.contactPhone).split('/')[0]).replace(/\D/g, ''));
          }
        }
      } catch (e) {
        console.error('Erreur chargement des paramètres de commande:', e);
        setSettingsError(true);
      }
    };
    loadSettings();
  }, []);
  
  const form = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      deliveryMethod: 'delivery',
    },
  });

  const deliveryMethod = form.watch('deliveryMethod');
  const deliveryCost = 0;
  const finalTotal = cartTotal + deliveryCost;

  useEffect(() => {
    if (cart.length === 0 && !isSubmitting) {
      router.replace('/cart');
    }
  }, [cart, router, isSubmitting]);

  if (cart.length === 0) {
    return null;
  }

  async function onSubmit(values: z.infer<typeof checkoutSchema>) {
    if (settingsError) {
      toast({
        variant: 'destructive',
        title: 'Paramètres indisponibles',
        description: 'Impossible de vérifier le contact WhatsApp. Veuillez actualiser la page.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const deliveryLabel = values.deliveryMethod === 'delivery'
        ? 'Livraison à domicile (frais à confirmer)'
        : 'Retrait en boutique (Gratuit)';

      const plainItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        storage: item.storage,
        price: item.price,
        quantity: item.quantity,
        thumbnail: item.thumbnail || '',
      }));

      const orderData = {
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        customerAddress: values.deliveryMethod === 'delivery' ? (values.customerAddress?.trim() || '') : 'Retrait en boutique',
        deliveryMethod: deliveryLabel,
        deliveryFee: deliveryCost,
        subTotal: cartTotal,
        total: finalTotal,
        totalFormatted: `${finalTotal.toLocaleString('fr-FR')} CFA`,
        status: 'En attente',
        createdAt: serverTimestamp(),
        date: serverTimestamp(),
        items: plainItems,
      };

      // Enregistrement direct et garanti dans Firestore côté client
      await addDoc(collection(db, 'orders'), orderData);

      toast({
        title: "Commande confirmée avec succès !",
        description: "Merci pour votre commande. Redirection vers WhatsApp...",
      });

      // Formatage du message WhatsApp
      const itemsListText = cart.map(i => `• ${i.name} (${i.storage}) x${i.quantity} : ${(i.price * i.quantity).toLocaleString('fr-FR')} CFA`).join('\n');
      const adresseInfo = values.deliveryMethod === 'delivery'
        ? `\n• Adresse de livraison : ${values.customerAddress}`
        : '\n• Mode : Retrait en magasin (Gratuit)';

      const message = `Bonjour Khalil Apple ! Je viens de passer une commande :\n\n${itemsListText}\n\n• Sous-total : ${cartTotal.toLocaleString('fr-FR')} CFA\n• Livraison : ${deliveryLabel}\n• Total produit (hors livraison) : ${finalTotal.toLocaleString('fr-FR')} CFA\n\n• Client : ${values.customerName}\n• Téléphone : ${values.customerPhone}${adresseInfo}`;
      const targetNumber = whatsappNumber.replace(/\+/g, '');
      const whatsappUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;

      clearCart();

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        router.push('/');
      }, 600);

    } catch (error: any) {
      console.error('Erreur lors de la validation de la commande:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur lors de la commande',
        description: error.message || "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.",
      });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4 md:px-6">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline mb-8">Finaliser ma commande</h1>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <User className="w-5 h-5 text-amber-400" />
                              1. Vos coordonnées
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="customerName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom complet</FormLabel>
                                        <FormControl><Input placeholder="Prénom et Nom" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="customerPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Numéro de téléphone (WhatsApp)</FormLabel>
                                        <FormControl><Input type="tel" placeholder="Ex: 77 123 45 67" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {deliveryMethod === 'delivery' && (
                              <FormField
                                  control={form.control}
                                  name="customerAddress"
                                  render={({ field }) => (
                                      <FormItem>
                                          <FormLabel className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4 text-amber-400" />
                                            Adresse de livraison à Dakar
                                          </FormLabel>
                                          <FormControl><Input placeholder="Ex: Sacré-Cœur 3, Villa 123, Dakar" {...field} /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Truck className="w-5 h-5 text-amber-400" />
                              2. Mode de livraison
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="deliveryMethod"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-2"
                                    >
                                        <FormItem>
                                            <FormControl>
                                                <Label htmlFor="delivery" className={cn("flex items-center gap-4 rounded-md border p-4 cursor-pointer hover:bg-accent/50 transition-colors", field.value === 'delivery' && 'bg-accent border-primary ring-2 ring-primary')}>
                                                    <RadioGroupItem value="delivery" id="delivery" />
                                                    <Truck className="h-6 w-6 text-amber-400" />
                                                    <div className="flex-1">
                                                        <p className="font-semibold">Livraison à domicile</p>
                                                        <p className="text-sm text-muted-foreground">Frais à confirmer avec le client</p>
                                                    </div>
                                                </Label>
                                            </FormControl>
                                        </FormItem>
                                        <FormItem>
                                             <FormControl>
                                                <Label htmlFor="pickup" className={cn("flex items-center gap-4 rounded-md border p-4 cursor-pointer hover:bg-accent/50 transition-colors", field.value === 'pickup' && 'bg-accent border-primary ring-2 ring-primary')}>
                                                    <RadioGroupItem value="pickup" id="pickup" />
                                                    <Store className="h-6 w-6 text-amber-400" />
                                                    <div className="flex-1">
                                                        <p className="font-semibold">Retrait en boutique</p>
                                                        <p className="text-sm text-emerald-400 font-medium">Gratuit - Retrait immédiat</p>
                                                    </div>
                                                </Label>
                                             </FormControl>
                                        </FormItem>
                                    </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                </div>
                <div>
                    <Card className="sticky top-20">
                        <CardHeader>
                            <CardTitle>Votre commande</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-64 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Image src={item.thumbnail || "https://placehold.co/100x100.png"} alt={item.name} width={64} height={64} className="rounded-md object-cover" />
                                        <div>
                                            <p className="font-medium">{item.name} ({item.storage})</p>
                                            <p className="text-sm text-muted-foreground">
                                              Quantité: {item.quantity}
                                              {item.isSinglePiece && <span className="ml-1 text-[10px] text-amber-400 font-semibold">(Pièce unique)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-medium">{(item.price * item.quantity).toLocaleString('fr-FR')} CFA</p>
                                </div>
                            ))}
                        </CardContent>
                        <Separator className="my-4" />
                        <CardFooter className="flex flex-col items-start space-y-2">
                            <div className="flex justify-between w-full">
                                <span>Sous-total</span>
                                <span>{cartTotal.toLocaleString('fr-FR')} CFA</span>
                            </div>
                            <div className="flex justify-between w-full">
                                <span>Livraison</span>
                                <span className={deliveryCost === 0 ? "text-emerald-400 font-medium" : ""}>
                                  {deliveryCost > 0 ? `${deliveryCost.toLocaleString('fr-FR')} CFA` : 'Gratuite'}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between w-full text-lg font-bold">
                                <span>Total</span>
                                <span className="text-amber-400">{finalTotal.toLocaleString('fr-FR')} CFA</span>
                            </div>

                             <Button type="submit" className="w-full mt-6 bg-amber-400 hover:bg-amber-500 text-black font-extrabold" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Finalisation de la commande...
                                  </>
                                ) : (
                                  `Confirmer la commande (${finalTotal.toLocaleString('fr-FR')} CFA)`
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </form>
        </Form>
    </div>
  );
}
