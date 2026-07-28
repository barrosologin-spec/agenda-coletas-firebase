// A página de login é a porta de entrada para o sistema.
// O design é centralizado e limpo para focar na ação de login.
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { JfabLogo } from '@/components/jfab_logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 48 48" {...props}>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C39.999 36.658 44 31.138 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
)

// Função da página de login.
export default function JfabPaginaLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/jfab_dashboard');
    } catch (error) {
      console.error("Erro de login:", error);
      toast({
        title: "Erro de Autenticação",
        description: "E-mail ou senha incorretos. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Verificar se o usuário já existe no Firestore
      const userDocRef = doc(db, 'jfab_usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // Se não existir, cria um novo perfil de usuário com nível 'Pendente'
        await setDoc(userDocRef, {
          id: user.uid,
          nome: user.displayName || 'Usuário Google',
          email: user.email,
          nivel: 'Pendente', // Nível padrão para novos usuários do Google
          telefone: user.phoneNumber || '',
        });
        toast({ title: 'Bem-vindo!', description: 'Sua conta foi criada. Aguarde a aprovação do administrador.'});
      }
      
      router.push('/jfab_dashboard');
    } catch (error: any) {
       console.error("Erro de login com Google:", error);
       toast({
        title: "Erro de Autenticação com Google",
        description: error.message || "Não foi possível autenticar com o Google. Tente novamente.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow flex flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center">
               <JfabLogo />
            </div>
            <CardTitle className="text-2xl">Acesse sua conta</CardTitle>
            <CardDescription>
              Entre com seu e-mail e senha para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jfab_email">E-mail</Label>
                <Input 
                  id="jfab_email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jfab_senha">Senha</Label>
                <Input 
                  id="jfab_senha" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {/* O botão de login usa a cor de destaque para chamar a atenção. */}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
                Entrar
              </Button>
            </form>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OU CONTINUE COM</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Entrar com Google
            </Button>
          </CardContent>
        </Card>
      </main>
      <footer className="py-4 px-6 text-center text-muted-foreground text-sm">
          <p className="mb-2">Desenvolvido por José Felipe A. Barroso</p>
          <div className="flex justify-center items-center gap-4">
              <span title="Next.js">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 128 128"><path fill="currentColor" d="M64 128c35.346 0 64-28.654 64-64S99.346 0 64 0 0 28.654 0 64s28.654 64 64 64M44.13 105.86V44h8.904v53.334l40.352-53.333H102V84h-8.904V30.666L52.744 84H44.13Z"/></svg>
              </span>
              <span title="Firebase">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024"><path fill="currentColor" d="M151.04 405.504L522.24 81.92l320 206.848l-256 599.04zM534.528 119.808l-289.024 232.96l20.48 30.72L534.528 119.808zM215.04 696.32l230.4-532.48l153.6 102.4l-204.8 481.28zM808.96 337.92L568.32 880.64L768 942.08l102.4-665.6z"/></svg>
              </span>
               <span title="ShadCN UI">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m-44.49 148.49l-22.62-22.62a8 8 0 0 1 11.31-11.31l17 16.9l65.1-65.1a8 8 0 0 1 11.32 11.32l-70.76 70.75a8 8 0 0 1-5.65 2.35a8 8 0 0 1-5.66-2.34"/></svg>
              </span>
               <span title="Tailwind CSS">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024"><path fill="currentColor" d="M255.5 256h-63.8c-17.7 0-32 14.3-32 32v64h32v-64h63.8c17.7 0 32-14.3 32-32s-14.3-32-32-32m513 512h-63.8c-17.7 0-32 14.3-32 32s14.3 32 32 32h63.8c17.7 0 32-14.3 32-32s-14.3-32-32-32m-128-256c-70.7 0-128 57.3-128 128s57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128m0 192c-35.3 0-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64s-28.7 64-64 64m-384-64c-70.7 0-128 57.3-128 128s57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128m0 192c-35.3 0-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64s-28.7 64-64 64"/></svg>
              </span>
              <span title="Genkit">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 0C229.227 0 0 229.227 0 512s229.227 512 512 512s512-229.227 512-512S794.773 0 512 0m-21.333 106.667h42.666v213.333h-42.666zm-106.667 0h42.667v213.333h-42.667zm-106.667 0h42.667v213.333H277.333zm-42.666 213.333h298.666v42.667H234.667zm-42.667-213.333h42.667v213.333H192zm234.667 426.667h-42.667V362.667h42.667zm106.667 0h-42.667V362.667h42.667zm106.666 0h-42.666V362.667h42.666zm42.667-426.667H469.333v-42.667h298.667zm42.667 426.667h-42.667V362.667h42.667zm-362.667 213.333h-42.666V746.667h42.666zm106.666 0h-42.666V746.667h42.666zm106.667 0h-42.667V746.667h42.667zm42.667-213.333h-298.667v-42.667h298.667zm42.666 213.333h-42.666V746.667h42.666z"/></svg>
              </span>
          </div>
      </footer>
    </div>
  );
}
