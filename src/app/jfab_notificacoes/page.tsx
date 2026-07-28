// Esta página exibirá o histórico de notificações do sistema.
// As notificações devem ser carregadas em tempo real do Firebase.
"use client"
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, BellRing, CheckCheck, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notificacao, Usuario } from '@/types/jfab_types';
import type { User } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const NotificacaoItem = ({ notif }: { notif: Notificacao }) => {
    return (
        <div
        key={notif.id}
        className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${!notif.read ? 'bg-primary/5 border-primary/20' : 'bg-transparent'}`}
        >
        <Avatar className="h-9 w-9 border">
            <AvatarFallback className={!notif.read ? 'bg-primary/10 text-primary' : ''}>
                <BellRing className="h-4 w-4"/>
            </AvatarFallback>
        </Avatar>
        <div className="grid gap-1 flex-1">
            <p className={`font-medium leading-none ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
            {notif.title}
            </p>
            <p className={`text-sm ${!notif.read ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}>
            {notif.desc}
            </p>
            <div className="text-xs text-muted-foreground/80 pt-1">
                {formatDistanceToNow(notif.time, { addSuffix: true, locale: ptBR })}
            </div>
        </div>
        {!notif.read && (
            <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0" aria-label="Não lida"></div>
        )}
        </div>
    )
}

const NotificacoesAgrupadas = ({ notificacoes }: { notificacoes: Notificacao[] }) => {
     const groupedNotifications = notificacoes.reduce((acc, notif) => {
        let group: string;
        if(isToday(notif.time)){
            group = 'Hoje';
        } else if (isYesterday(notif.time)){
            group = 'Ontem';
        } else {
            group = 'Anteriores';
        }
        if(!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(notif);
        return acc;
    }, {} as Record<string, Notificacao[]>);

    return (
        <div className="space-y-6">
        {Object.entries(groupedNotifications).map(([group, notifs]) => (
            <div key={group}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">{group}</h3>
                 <div className="space-y-4">
                    {notifs.map((notif) => (
                       <NotificacaoItem key={notif.id} notif={notif} />
                    ))}
                </div>
            </div>
        ))}
        </div>
    )
}


export default function JfabNotificacoesPage() {
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<Usuario | null>(null);

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                const q = query(collection(db, 'jfab_usuarios'), where('email', '==', user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setUserProfile({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Usuario);
                } else {
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
        });

        const q = query(collection(db, 'jfab_notificacoes'), orderBy('time', 'desc'));
        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
            const data: Notificacao[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: doc.data().time.toDate(),
            } as Notificacao));
            setNotificacoes(data);
            setLoading(false);
        }, error => {
            console.error("Erro ao buscar notificações:", error);
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeNotifs();
        };
    }, []);

    const handleMarcarTodasComoLidas = async () => {
        const batch = writeBatch(db);
        const unreadNotifs = notificacoes.filter(n => !n.read && !n.arquivada);
        if(unreadNotifs.length === 0) return;

        unreadNotifs.forEach(notif => {
            const notifRef = doc(db, 'jfab_notificacoes', notif.id);
            batch.update(notifRef, { read: true });
        });
        await batch.commit();
    };
    
    const handleLimparOuArquivarLidas = async () => {
        const batch = writeBatch(db);
        const readNotifs = ativas.filter(n => n.read);
        if(readNotifs.length === 0) return;

        if(userProfile?.nivel === 'Administrador') {
             // Excluir permanentemente
            readNotifs.forEach(notif => {
                const notifRef = doc(db, 'jfab_notificacoes', notif.id);
                batch.delete(notifRef);
            });
        } else {
            // Apenas arquivar
             readNotifs.forEach(notif => {
                const notifRef = doc(db, 'jfab_notificacoes', notif.id);
                batch.update(notifRef, { arquivada: true });
            });
        }
        await batch.commit();
    }
    
    const handleRestaurarArquivadas = async () => {
        const batch = writeBatch(db);
        const archivedNotifs = arquivadas;
        if(archivedNotifs.length === 0) return;
        
        archivedNotifs.forEach(notif => {
             const notifRef = doc(db, 'jfab_notificacoes', notif.id);
             batch.update(notifRef, { arquivada: false });
        });
        await batch.commit();
    }

    const ativas = notificacoes.filter(n => !n.arquivada);
    const arquivadas = notificacoes.filter(n => n.arquivada);
    const unreadCount = ativas.filter(n => !n.read).length;
    const readCount = ativas.filter(n => n.read).length;
    
    const isAdmin = userProfile?.nivel === 'Administrador';

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                <CardTitle>Central de Notificações</CardTitle>
                <CardDescription>
                    {unreadCount > 0 
                        ? `Você tem ${unreadCount} notificações não lidas.`
                        : "Nenhuma nova notificação."
                    }
                </CardDescription>
            </div>
            <div className='flex gap-2'>
                <Button variant="outline" onClick={handleLimparOuArquivarLidas} disabled={readCount === 0}>
                    {isAdmin ? <Trash2 className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                    {isAdmin ? 'Limpar Lidas (Excluir)' : 'Arquivar Lidas'}
                </Button>
                <Button variant="outline" onClick={handleMarcarTodasComoLidas} disabled={unreadCount === 0}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Marcar todas como lidas
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
          {loading ? (
             <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
        <Tabs defaultValue="novas">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="novas">
                    Novas
                    {unreadCount > 0 && <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">{unreadCount}</span>}
                </TabsTrigger>
                <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
            </TabsList>
            <TabsContent value="novas" className="mt-6">
                 {ativas.length === 0 ? (
                    <div className="text-center py-20">
                        <BellRing className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">Tudo em ordem</h3>
                        <p className="mt-2 text-sm text-muted-foreground">Nenhuma notificação por aqui. Bom trabalho!</p>
                    </div>
                ) : (
                    <NotificacoesAgrupadas notificacoes={ativas} />
                )}
            </TabsContent>
            <TabsContent value="arquivadas" className="mt-6">
                {arquivadas.length === 0 ? (
                    <div className="text-center py-20">
                        <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">Nenhuma notificação arquivada</h3>
                        <p className="mt-2 text-sm text-muted-foreground">As notificações que você arquivar aparecerão aqui.</p>
                    </div>
                ) : (
                    <>
                    <div className="flex justify-end mb-4">
                        <Button variant="outline" size="sm" onClick={handleRestaurarArquivadas}>
                            <ArchiveRestore className="mr-2 h-4 w-4"/>
                            Restaurar Todas
                        </Button>
                    </div>
                    <NotificacoesAgrupadas notificacoes={arquivadas} />
                    </>
                )}
            </TabsContent>
        </Tabs>
       )}
      </CardContent>
    </Card>
  );
}
