// Este é o componente de layout principal para páginas autenticadas.
// Ele encapsula a navegação lateral (sidebar) e o cabeçalho da página.
"use client";

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Package, 
  Truck, 
  Users, 
  Bell, 
  LogOut,
  ChevronDown,
  CalendarDays,
  DollarSign,
  Car,
  Cog
} from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs, QuerySnapshot, DocumentData, or } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Usuario } from '@/types/jfab_types';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { JfabLogo } from '@/components/jfab_logo';
import { JfabSeletorTema } from '@/components/jfab_seletor_tema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { ClientOnly } from './client_only';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Lista de itens de navegação para a sidebar.
const jfab_itens_navegacao = [
  { href: '/jfab_dashboard', label: 'Dashboard', icon: Home, roles: ['Administrador', 'Operador'] },
  { href: '/jfab_agendamentos', label: 'Operações', icon: Package, roles: ['Administrador', 'Operador'] },
  { href: '/jfab_calendario', label: 'Calendário', icon: CalendarDays, roles: ['Administrador', 'Operador'] },
  { href: '/jfab_pagamentos', label: 'Pagamentos', icon: DollarSign, roles: ['Administrador', 'Operador'] },
  { href: '/jfab_veiculos', label: 'Veículos', icon: Car, roles: ['Administrador', 'Operador'] },
  { href: '/jfab_rotas', label: 'Rotas', icon: Truck, roles: ['Administrador', 'Operador', 'Motorista'] },
  { href: '/jfab_usuarios', label: 'Usuários', icon: Users, roles: ['Administrador'] },
  { href: '/jfab_configuracoes', label: 'Configurações', icon: Cog, roles: ['Administrador'] },
];

function JfabLayoutContent({ children }: { children: React.ReactNode }) {
  const jfab_pathname = usePathname();
  const router = useRouter();
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [userProfile, setUserProfile] = React.useState<Usuario | null>(null);
  const { state } = useSidebar();
  const { toast } = useToast();
  const hasRedirected = React.useRef(false);

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setCurrentUser(user);
            const userDocRef = collection(db, 'jfab_usuarios');
            // Prioriza a busca por UID, que é o padrão do Firebase Auth
            const q = query(userDocRef, where('id', '==', user.uid));
            let querySnapshot = await getDocs(q);

            // Fallback para email se não encontrar por UID (para usuários antigos)
            if (querySnapshot.empty && user.email) {
                const qEmail = query(userDocRef, where('email', '==', user.email));
                querySnapshot = await getDocs(qEmail);
            }

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const profile = { id: userDoc.id, ...userDoc.data() } as Usuario;

                if (profile.nivel && profile.nivel !== 'Pendente') {
                    setUserProfile(profile);
                    // Adiciona o nome do usuário ao token para uso nas regras de segurança
                    if (auth.currentUser && auth.currentUser.displayName !== profile.nome) {
                       try {
                           await updateProfile(auth.currentUser, { displayName: profile.nome });
                       } catch(e) {
                           console.error("Falha ao atualizar o perfil do Firebase Auth:", e);
                       }
                    }
                    if (profile.nivel === 'Motorista' && !hasRedirected.current && !jfab_pathname.startsWith('/jfab_rotas')) {
                        router.push('/jfab_rotas');
                        hasRedirected.current = true;
                    }
                } else {
                    setUserProfile(null);
                     toast({
                        title: "Acesso Pendente",
                        description: "Sua conta aguarda aprovação de um administrador.",
                        variant: "destructive"
                    });
                }
            } else {
                 console.warn("Nenhum perfil de usuário encontrado no Firestore.");
                 setUserProfile(null);
            }
        } else {
            setCurrentUser(null);
            setUserProfile(null);
            router.push('/');
        }
    });
    
    // Configura o listener de notificações apenas quando o perfil do usuário está carregado
    let unsubscribeNotifs: (() => void) | undefined;
    if (userProfile) {
        const qNotifs = query(
            collection(db, 'jfab_notificacoes'),
            or(
                where('paraUsuarioId', '==', userProfile.id),
                where('paraUsuarioId', '==', null)
            )
        );
        unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
            const unreadCount = snapshot.docs.filter(doc => !doc.data().read).length;
            setUnreadNotifications(unreadCount);
        });
    }

    return () => {
        unsubscribeAuth();
        if (unsubscribeNotifs) {
            unsubscribeNotifs();
        }
    };
  }, [router, toast, jfab_pathname, userProfile]);

  const handleLogout = async () => {
    try {
      hasRedirected.current = false;
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };
  
  const filteredNavItems = jfab_itens_navegacao.filter(item => 
      userProfile && item.roles.includes(userProfile.nivel)
  );

  const jfab_titulo_pagina = jfab_itens_navegacao.find(item => jfab_pathname.startsWith(item.href))?.label || 'JFab Coleta';
  const userInitials = userProfile?.nome?.substring(0, 2).toUpperCase() || currentUser?.email?.substring(0, 2).toUpperCase() || '..';

  return (
    <>
       <Sidebar collapsible="icon">
          <SidebarHeader>
              <JfabLogo className={cn(state === 'collapsed' && '[&>h1]:hidden')} />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href}>
                    <SidebarMenuButton isActive={jfab_pathname.startsWith(item.href)} tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start h-auto p-2">
                      <div className="flex justify-between w-full items-center">
                          <div className="flex gap-2 items-center">
                              <Avatar className="h-8 w-8">
                                  <AvatarImage src={currentUser?.photoURL || "https://placehold.co/100x100.png"} alt={userProfile?.nome || "user avatar"} data-ai-hint="user avatar" />
                                  <AvatarFallback>{userInitials}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col items-start text-left group-data-[collapsible=icon]:hidden">
                                  <span className="text-sm font-medium truncate">{userProfile?.nome || currentUser?.email}</span>
                                  <span className="text-sm text-muted-foreground truncate">{userProfile?.nivel || 'Acesso restrito'}</span>
                              </div>
                          </div>
                           <ChevronDown className="w-4 h-4 group-data-[collapsible=icon]:hidden" />
                      </div>
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
            <SidebarTrigger className="md:hidden" />
            <h1 className="flex-1 text-xl font-semibold">{userProfile ? jfab_titulo_pagina : "Acesso Restrito"}</h1>
            <div className="flex items-center gap-2">
              <JfabSeletorTema />
              <Link href="/jfab_notificacoes">
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Ver notificações</span>
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {unreadNotifications}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {userProfile ? children : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-2xl font-bold">Acesso Restrito</h2>
                    <p className="text-muted-foreground mt-2">Sua conta está aguardando aprovação de um administrador.</p>
                    <p className="text-muted-foreground text-sm mt-1">Por favor, entre em contato com o suporte ou aguarde.</p>
                     <Button onClick={handleLogout} className="mt-4">
                      Sair
                    </Button>
                </div>
            )}
          </main>
         <footer className="py-4 px-6 text-center text-muted-foreground text-sm border-t">
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024"><path fill="currentColor" d="M255.5 256h-63.8c-17.7 0-32 14.3-32 32v64h32v-64h63.8c-17.7 0 32-14.3 32-32s-14.3-32-32-32m513 512h-63.8c-17.7 0-32 14.3-32 32s14.3 32 32 32h63.8c17.7 0 32-14.3 32-32s-14.3-32-32-32m-128-256c-70.7 0-128 57.3-128 128s57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128m0 192c-35.3 0-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64s-28.7 64-64 64m-384-64c-70.7 0-128 57.3-128 128s57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128m0 192c-35.3 0-64-28.7-64-64s28.7-64 64-64s64 28.7 64 64s-28.7 64-64 64"/></svg>
                </span>
               <span title="Genkit">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 0C229.227 0 0 229.227 0 512s229.227 512 512 512s512-229.227 512-512S794.773 0 512 0m-21.333 106.667h42.666v213.333h-42.666zm-106.667 0h42.667v213.333h-42.667zm-106.667 0h42.667v213.333H277.333zm-42.666 213.333h298.666v42.667H234.667zm-42.667-213.333h42.667v213.333H192zm234.667 426.667h-42.667V362.667h42.667zm106.667 0h-42.667V362.667h42.667zm106.666 0h-42.666V362.667h42.666zm42.667-426.667H469.333v-42.667h298.667zm42.667 426.667h-42.667V362.667h42.667zm-362.667 213.333h-42.666V746.667h42.666zm106.666 0h-42.666V746.667h42.666zm106.667 0h-42.667V746.667h42.667zm42.667-213.333h-298.667v-42.667h298.667zm42.666 213.333h-42.666V746.667h42.666z"/></svg>
               </span>
           </div>
         </footer>
        </SidebarInset>
    </>
  )
}

export function JfabLayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ClientOnly>
        <JfabLayoutContent>{children}</JfabLayoutContent>
      </ClientOnly>
    </SidebarProvider>
  );
}
