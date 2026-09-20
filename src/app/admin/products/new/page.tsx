// src/app/admin/products/new/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Trash, PlusCircle, UploadCloud, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, serverTimestamp, onSnapshot, query, DocumentData, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductVariant } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { invalidateCatalogCache } from '@/lib/product-cache';

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [categoryId, setCategoryId] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [batteryHealth, setBatteryHealth] = useState('');
  const [keywords, setKeywords] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([{ storage: '', price: 0 }]);
  const [hasIMEI, setHasIMEI] = useState(false);
  const [categories, setCategories] = useState<DocumentData[]>([]);

  // Badges marketing et mise en avant
  const [customBadge, setCustomBadge] = useState<string>('none');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isFlashSale, setIsFlashSale] = useState<boolean>(false);
  const [flashSalePrice, setFlashSalePrice] = useState<number>(0);
  const [flashSaleEndDate, setFlashSaleEndDate] = useState<string>('');

  // Champs dédiés exemplaire initial IMEI
  const [imeiNumber, setImeiNumber] = useState('');
  const [imeiCondition, setImeiCondition] = useState<'venant' | 'secondHand' | 'none'>('venant');
  const [imeiStorage, setImeiStorage] = useState('');
  const [imeiOriginalPrice, setImeiOriginalPrice] = useState<number>(0);
  const [imeiUnitPrice, setImeiUnitPrice] = useState<number>(0);
  const [hasImeiCustomPrice, setHasImeiCustomPrice] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const CLOUDINARY_CLOUD_NAME = 'dm6yuokre';
  const CLOUDINARY_UPLOAD_PRESET = 'khalil_apple';

  useEffect(() => {
    const q = query(collection(db, "categories"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const categoriesData: DocumentData[] = [];
      querySnapshot.forEach((doc) => {
        categoriesData.push({ id: doc.id, ...doc.data() });
      });
      setCategories(categoriesData);
    });

    return () => unsubscribe();
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const handleVariantChange = (index: number, field: keyof ProductVariant, value: string | number) => {
    const newVariants = [...variants];
    const variant = newVariants[index];
    if (field === 'price') {
      variant.price = Number(value);
    } else if (field === 'storage') {
      variant.storage = String(value);
    } else {
      (variant as any)[field] = value;
    }
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { storage: '', price: 0 }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length > 1) {
      const newVariants = variants.filter((_, i) => i !== index);
      setVariants(newVariants);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setThumbnail('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, true);
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                setThumbnail(response.secure_url);
                toast({ title: 'Succès', description: 'Image téléversée avec succès.' });
            } else {
                 throw new Error(`Upload failed with status: ${xhr.status}`);
            }
            setIsUploading(false);
        };
        
        xhr.onerror = () => {
             toast({ variant: 'destructive', title: 'Erreur', description: "Le téléversement de l'image a échoué. Veuillez vérifier votre console." });
             console.error('Upload Error:', xhr.statusText);
             setIsUploading(false);
        };

        xhr.send(formData);

    } catch (error) {
        setIsUploading(false);
        toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de téléverser l'image." });
        console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const missingFields: string[] = [];
    if (!name.trim()) missingFields.push('le nom du produit');
    if (!slug.trim()) missingFields.push('le slug');
    if (!categoryId) missingFields.push('la catégorie');
    if (!thumbnail) missingFields.push("l'image");
    if (variants.some(v => !v.storage || v.price <= 0)) {
        missingFields.push('une variante avec un stockage et un prix supérieur à 0');
    }

    if (missingFields.length > 0) {
        toast({
            variant: 'destructive',
            title: "Erreur de validation",
            description: `Veuillez compléter : ${missingFields.join(', ')}.`,
        });
        setIsSubmitting(false);
        return;
    }
    
    try {
      const productData: Omit<Product, 'id'> = {
        name,
        slug,
        status,
        categoryId,
        thumbnail,
        batteryHealth,
        keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
        variants,
        hasIMEI,
        isFeatured: Boolean(isFeatured),
        isFlashSale: Boolean(isFlashSale),
        createdAt: serverTimestamp()
      };

      if (customBadge !== 'none') {
        productData.customBadge = customBadge;
      }
      if (isFlashSale && Number(flashSalePrice) > 0) {
        productData.flashSalePrice = Number(flashSalePrice);
      }
      if (isFlashSale && flashSaleEndDate) {
        productData.flashSaleEndDate = new Date(flashSaleEndDate);
      }

      const productRef = doc(collection(db, 'products'));
      const batch = writeBatch(db);
      batch.set(productRef, productData);

      // Si un numéro IMEI a été saisi, créer directement l'exemplaire dans l'inventaire
      if (hasIMEI && imeiNumber.trim()) {
        const selectedVar = variants.find(v => v.storage === imeiStorage) || variants[0];
        const catalogP = Number(imeiOriginalPrice) || Number(selectedVar?.price) || 0;
        const finalP = hasImeiCustomPrice && Number(imeiUnitPrice) > 0 ? Number(imeiUnitPrice) : catalogP;

        const inventoryRef = doc(collection(db, 'inventory'));
        batch.set(inventoryRef, {
          productId: productRef.id,
          productName: name,
          imei: imeiNumber.trim(),
          storage: imeiStorage || selectedVar?.storage || '128GB',
          status: 'disponible',
          catalogPrice: catalogP,
          originalPrice: catalogP,
          unitPrice: finalP,
          hasCustomPrice: Boolean(hasImeiCustomPrice),
          isVenant: imeiCondition === 'venant',
          isSecondHand: imeiCondition === 'secondHand',
          note: 'Enregistré à la création du modèle',
          addedAt: serverTimestamp()
        });
      }

      await batch.commit();
      invalidateCatalogCache();

      toast({
        title: "Produit ajouté",
        description: `Le produit "${name}" a été créé avec succès${hasIMEI && imeiNumber.trim() ? " avec son exemplaire IMEI en stock" : ""}.`,
      });
      router.push('/admin/products');
    } catch (error) {
      console.error("Erreur lors de l'ajout du produit:", error);
      toast({
        variant: 'destructive',
        title: "Erreur",
        description: error instanceof Error
          ? `Création impossible : ${error.message}`
          : "Une erreur est survenue lors de la création du produit.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Button variant="outline" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations sur le produit</CardTitle>
                    <CardDescription>Remplissez les informations de base du produit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="space-y-2">
                        <Label htmlFor="product-name">Nom du produit</Label>
                        <Input id="product-name" value={name} onChange={handleNameChange} placeholder="Ex: iPhone 11 Pro Max" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Ex: iphone-11-pro-max" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="keywords">Mots-clés</Label>
                        <Textarea id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Séparez les mots-clés par une virgule. Ex: iphone, 11, pro, max" />
                    </div>
                     <div className="space-y-4">
                        <Label>Variantes de stockage et prix</Label>
                        {variants.map((variant, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <Select required value={variant.storage} onValueChange={(value) => handleVariantChange(index, 'storage', value)}>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Stockage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="64GB">64 GB</SelectItem>
                                    <SelectItem value="128GB">128 GB</SelectItem>
                                    <SelectItem value="256GB">256 GB</SelectItem>
                                    <SelectItem value="512GB">512 GB</SelectItem>
                                    <SelectItem value="1TB">1 TB</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    placeholder="Prix (CFA)"
                                    required
                                    value={variant.price === 0 ? '' : variant.price}
                                    onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                                />
                            </div>
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeVariant(index)} disabled={variants.length === 1}>
                                <Trash className="h-4 w-4" />
                            </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Ajouter une variante
                        </Button>
                    </div>
                  </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Image du produit</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                            {isUploading ? 'Téléversement...' : 'Choisir une image'}
                        </Button>
                        {isUploading && <Progress value={uploadProgress} className="mt-2 w-full" />}
                        {thumbnail && (
                            <div className="mt-4 aspect-square relative w-full overflow-hidden rounded-md border">
                                <Image src={thumbnail} alt="Aperçu du produit" fill className="object-cover" />
                            </div>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Organisation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <Label htmlFor="category">Catégorie</Label>
                            <Select value={categoryId} onValueChange={setCategoryId} required>
                                <SelectTrigger id="category">
                                    <SelectValue placeholder="Sélectionnez une catégorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="battery-health">Santé de la batterie</Label>
                            <Input id="battery-health" value={batteryHealth} onChange={(e) => setBatteryHealth(e.target.value)} placeholder="Ex: 90-100%" />
                        </div>

                        {/* Badges Marketing & Vedettes */}
                        <div className="p-3 bg-muted/40 rounded-xl border space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-badge" className="text-xs font-bold">Badge Marketing Spécial</Label>
                            <Select value={customBadge} onValueChange={setCustomBadge}>
                              <SelectTrigger id="custom-badge" className="h-9 text-xs">
                                <SelectValue placeholder="Aucun badge" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucun badge</SelectItem>
                                <SelectItem value="Bestseller">✦ Bestseller</SelectItem>
                                <SelectItem value="Nouveauté">✨ Nouveauté</SelectItem>
                                <SelectItem value="Offre Spéciale">🔥 Offre Spéciale</SelectItem>
                                <SelectItem value="Populaire">★ Populaire</SelectItem>
                                <SelectItem value="Coup de Cœur">❤️ Coup de Cœur</SelectItem>
                                <SelectItem value="Flagship">👑 Flagship</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={isFeatured}
                              onChange={(e) => setIsFeatured(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span>Mettre en avant sur la page d'accueil (Bento Grid)</span>
                          </label>
                        </div>

                        {/* Vente Flash */}
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
                          <label className="flex items-center gap-2 text-xs font-bold text-red-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isFlashSale}
                              onChange={(e) => setIsFlashSale(e.target.checked)}
                              className="rounded border-red-400 text-red-600 focus:ring-red-500"
                            />
                            <span>Activer en Vente Flash</span>
                          </label>

                          {isFlashSale && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-red-500/20">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Prix Flash (CFA)</Label>
                                <Input
                                  type="number"
                                  value={flashSalePrice || ''}
                                  onChange={(e) => setFlashSalePrice(Number(e.target.value))}
                                  placeholder="Prix promo"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Date limite</Label>
                                <Input
                                  type="datetime-local"
                                  value={flashSaleEndDate}
                                  onChange={(e) => setFlashSaleEndDate(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 py-2">
                            <input 
                                type="checkbox" 
                                id="hasIMEI" 
                                checked={hasIMEI} 
                                onChange={(e) => setHasIMEI(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="hasIMEI" className="flex items-center gap-2 cursor-pointer font-semibold">
                                <Smartphone className="h-4 w-4 text-primary" />
                                Gérer par IMEI (Stock unique)
                            </Label>
                        </div>

                        {hasIMEI && (
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                Premier exemplaire IMEI (facultatif)
                              </span>
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="imeiNumber" className="text-xs">Numéro IMEI (15 chiffres)</Label>
                              <Input 
                                id="imeiNumber"
                                value={imeiNumber}
                                onChange={(e) => setImeiNumber(e.target.value)}
                                placeholder="Ex: 354896102345678"
                                className="font-mono text-xs h-9"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">État</Label>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="imeiCondition" 
                                    checked={imeiCondition === 'venant'}
                                    onChange={() => setImeiCondition('venant')}
                                  />
                                  <span>✦ Venant</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="imeiCondition" 
                                    checked={imeiCondition === 'secondHand'}
                                    onChange={() => setImeiCondition('secondHand')}
                                  />
                                  <span>2ème main</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="imeiCondition" 
                                    checked={imeiCondition === 'none'}
                                    onChange={() => setImeiCondition('none')}
                                  />
                                  <span>Standard</span>
                                </label>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Stockage</Label>
                                <Select 
                                  value={imeiStorage || variants[0]?.storage || '128GB'} 
                                  onValueChange={(val) => {
                                    setImeiStorage(val);
                                    const found = variants.find(v => v.storage === val);
                                    if (found) {
                                      setImeiOriginalPrice(found.price);
                                      if (!hasImeiCustomPrice) setImeiUnitPrice(found.price);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Stockage" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variants.filter(v => v.storage).map((v) => (
                                      <SelectItem key={v.storage} value={v.storage}>{v.storage}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Prix catalogue (CFA)</Label>
                                <Input 
                                  type="number"
                                  value={imeiOriginalPrice || variants[0]?.price || ''}
                                  onChange={(e) => setImeiOriginalPrice(Number(e.target.value))}
                                  placeholder="Prix"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-border/40">
                              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={hasImeiCustomPrice}
                                  onChange={(e) => {
                                    setHasImeiCustomPrice(e.target.checked);
                                    if (e.target.checked && !imeiUnitPrice) {
                                      setImeiUnitPrice(imeiOriginalPrice || variants[0]?.price || 0);
                                    }
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span>Définir un nouveau prix pour cette unité</span>
                              </label>

                              {hasImeiCustomPrice && (
                                <div className="space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">Nouveau prix de vente (CFA)</Label>
                                  <Input 
                                    type="number"
                                    value={imeiUnitPrice || ''}
                                    onChange={(e) => setImeiUnitPrice(Number(e.target.value))}
                                    placeholder="Ex: 320000"
                                    className="h-8 text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="status">Statut</Label>
                            <Select value={status} onValueChange={(value) => setStatus(value as 'active' | 'inactive')}>
                            <SelectTrigger id="status" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Actif</SelectItem>
                                <SelectItem value="inactive">Inactif</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
         <div className="mt-8 flex justify-end">
            <Button type="submit" size="lg" disabled={isSubmitting || isUploading}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer le produit
            </Button>
          </div>
      </form>
    </div>
  );
}
