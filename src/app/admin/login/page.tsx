// src/app/admin/login/page.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.push('/admin/dashboard');
    }
  }, [user, isAdmin, loading, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().role === 'admin') {
        toast({
          title: "Connexion réussie",
          description: "Vous êtes maintenant connecté en tant qu'administrateur.",
        });
        router.push('/admin/dashboard');
      } else {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: "Accès refusé",
          description: "Vous n'avez pas les permissions pour accéder à cette page.",
        });
      }

    } catch (error) {
      console.error("Erreur de connexion:", error);
      toast({
        variant: 'destructive',
        title: "Erreur de connexion",
        description: "L'email ou le mot de passe est incorrect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || (user && isAdmin)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin}>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">Accès Admin</CardTitle>
            <CardDescription>Connectez-vous à votre espace administrateur</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@khalilapple.com" 
                  required 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
