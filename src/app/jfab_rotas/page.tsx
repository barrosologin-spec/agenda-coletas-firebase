// Esta página será usada para montar e visualizar as rotas de coleta.
"use client"
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp, arrayUnion, Timestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Agendamento, Usuario, HistoricoItem } from '@/types/jfab_types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, Truck, Play, Pause, Clock, Calendar as CalendarIcon, History, Home, ArrowRight, MapPin, User } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Calendar } from '@/components/ui/calendar';
import type { User as FirebaseUser } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { JfabDetalhesOperacao } from '@/components/jfab_detalhes_operacao';

const createNotification = async (title: string, desc: string) => {
  try {
    await addDoc(collection(db, 'jfab_notificacoes'), {
      title,
      desc,
      time: serverTimestamp(),
      read: false,
      arquivada: false,
    });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
};

const getBadgeClass = (status: string) => {
    switch (status) {
        case 'Concluído':
            return 'bg-green-500';
        case 'Pendente':
             return 'bg-yellow-500';
        case 'Em Rota':
            return 'bg-blue-500';
        case 'Cancelado':
             return 'bg-red-500';
        default:
            return 'bg-muted';
    }
};

const getBadgeClassForBadges = (status: string) => {
    switch (status) {
        case 'Concluído':
            return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
        case 'Pendente':
             return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
        case 'Em Rota':
            return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30';
        case 'Cancelado':
             return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30';
        default:
            return '';
    }
};


export default function JfabRotasPage() {
    const [todosAgendamentos, setTodosAgendamentos] = useState<Agendamento[]>([]);
    const [motoristas, setMotoristas] = useState<string[]>([]);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [agendamentoToUpdate, setAgendamentoToUpdate] = useState<{agendamento: Agendamento, status: 'Concluído' | 'Cancelado'} | null>(null);
    const [agendamentoToStart, setAgendamentoToStart] = useState<Agendamento | null>(null);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<Usuario | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
    const { toast } = useToast();
    
    const isMotorista = userProfile?.nivel === 'Motorista';
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                 const userDocRef = collection(db, 'jfab_usuarios');
                 const q = query(userDocRef, where('id', '==', user.uid));
                 let querySnapshot = await getDocs(q);
                 if (querySnapshot.empty && user.email) {
                    const qEmail = query(collection(db, 'jfab_usuarios'), where('email', '==', user.email));
                    querySnapshot = await getDocs(qEmail);
                 }

                 if (!querySnapshot.empty) {
                     const userDoc = querySnapshot.docs[0];
                     const profile = { id: userDoc.id, ...userDoc.data() } as Usuario;
                     setUserProfile(profile);
                      if (profile.nivel === 'Motorista') {
                        setMotoristaSelecionado(profile.nome);
                    }
                 } else {
                     setUserProfile(null);
                 }
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, [router]);

    // Busca todos os agendamentos e motoristas
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'jfab_agendamentos'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Agendamento[] = snapshot.docs.map(doc => {
                const docData = doc.data();
                 const historico = docData.historico?.map((h: any) => ({
                    ...h,
                    data: h.data.toDate(),
                })) || [];

                return { 
                    id: doc.id, 
                    ...docData,
                    data: docData.data.toDate(),
                    historico: historico,
                    rota_iniciada_em: docData.rota_iniciada_em?.toDate(),
                    rota_finalizada_em: docData.rota_finalizada_em?.toDate(),
                } as Agendamento
            });
            
            setTodosAgendamentos(data);
            
            if (!isMotorista) {
                const motoristasUnicos = [...new Set(data.map(a => a.motorista))];
                setMotoristas(motoristasUnicos);

                if (motoristasUnicos.length > 0) {
                     setMotoristaSelecionado(motoristaSelecionado => 
                        motoristasUnicos.includes(motoristaSelecionado!) ? motoristaSelecionado : motoristasUnicos[0]
                    );
                } else {
                    setMotoristaSelecionado(null);
                }
            }
            setLoading(false);
        }, error => {
            console.error("Erro ao buscar coletas:", error);
            toast({ title: "Erro", description: "Não foi possível carregar as coletas.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast, isMotorista]);

    const agendamentosDoMotorista = useMemo(() => {
        if (!motoristaSelecionado) return [];
        return todosAgendamentos.filter(a => a.motorista === motoristaSelecionado);
    }, [todosAgendamentos, motoristaSelecionado]);

    const handleUpdateStatus = async (agendamento: Agendamento, status: 'Concluído' | 'Cancelado' | 'Em Rota' | 'Pendente') => {
        if (!currentUser) {
            toast({ title: "Erro de Autenticação", description: "Usuário não está logado para realizar esta ação.", variant: "destructive" });
            return;
        }
        
        if (isMotorista && userProfile?.nome !== agendamento.motorista) {
            toast({ title: "Acesso Negado", description: "Você só pode alterar o status de suas próprias rotas.", variant: "destructive" });
            return;
        }

        const q = query(collection(db, 'jfab_usuarios'), where('email', '==', currentUser.email));
        const userQuerySnapshot = await getDocs(q);
        const usuarioLogado = userQuerySnapshot.empty ? currentUser.email : userQuerySnapshot.docs[0].data().nome;

        const docRef = doc(db, 'jfab_agendamentos', agendamento.id);
        const newHistoryEntry = { 
            campo: 'Status', 
            de: agendamento.status, 
            para: status, 
            data: Timestamp.now(), 
            usuario: usuarioLogado!
        };
        
        const updateData: any = {
            status: status,
            historico: arrayUnion(newHistoryEntry)
        };

        if (status === 'Em Rota') {
             if (!agendamento.rota_iniciada_em) {
                updateData.rota_iniciada_em = serverTimestamp();
             }
        } else if (status === 'Pendente' && agendamento.status === 'Em Rota') {
            // Não fazemos nada com o tempo ao pausar, apenas mudamos o status
        } else if (status === 'Concluído') {
            const finalizadaEm = new Date();
            updateData.rota_finalizada_em = Timestamp.fromDate(finalizadaEm);
            if(agendamento.rota_iniciada_em){
                 updateData.duracao_rota_minutos = differenceInMinutes(finalizadaEm, agendamento.rota_iniciada_em);
            }
        }

        try {
            await updateDoc(docRef, updateData);
            toast({ title: "Sucesso!", description: `Operação marcada como "${status}".` });
            await createNotification(
                `Status de Operação Alterado`,
                `A operação para ${agendamento.cliente} foi atualizada para "${status}" por ${usuarioLogado}.`
            );
            
             // Abrir o Google Maps se for "Em Rota"
            if (status === 'Em Rota') {
                const destinationAddress = agendamento.tipo === 'Coleta' ? agendamento.origem?.endereco : agendamento.origem?.endereco;
                if (destinationAddress) {
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`;
                    window.open(mapsUrl, '_blank');
                } else {
                    toast({ title: "Atenção", description: "Endereço de destino não encontrado para iniciar a rota no mapa.", variant: "destructive" });
                }
            }
        } catch (error) {
            console.error(`Erro ao atualizar status para ${status}:`, error);
            toast({ title: "Erro", description: "Não foi possível atualizar o status da operação.", variant: "destructive" });
        } finally {
            setAgendamentoToUpdate(null);
            setAgendamentoToStart(null);
        }
    };
    
    const handleViewDetails = (agendamento: Agendamento) => {
        setSelectedAgendamento(agendamento);
        setIsDetailsOpen(true);
    }

    const Timer = ({ startTime }: { startTime?: Date }) => {
        const [duration, setDuration] = useState(0);
        
        useEffect(() => {
            if (!startTime) {
                setDuration(0);
                return;
            }
            
            const interval = setInterval(() => {
                setDuration(differenceInMinutes(new Date(), startTime));
            }, 60000); // Atualiza a cada minuto

            setDuration(differenceInMinutes(new Date(), startTime)); // Seta o valor inicial

            return () => clearInterval(interval);
        }, [startTime]);

        if (!startTime) return null;

        return (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
                <Clock className="h-3 w-3 animate-pulse" />
                <span>{duration} min</span>
            </div>
        )
    }

    const agendamentosDoDia = agendamentosDoMotorista
        .filter(a => isSameDay(a.data, selectedDate) && ['Pendente', 'Em Rota'].includes(a.status))
        .sort((a,b) => a.data.getTime() - b.data.getTime());
        
    const historicoAgendamentos = agendamentosDoMotorista
        .filter(a => ['Concluído', 'Cancelado'].includes(a.status))
        .sort((a,b) => b.data.getTime() - a.data.getTime());

    return (
        <>
        <AlertDialog>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
            <div className="md:col-span-4 lg:col-span-3 space-y-6">
                 <Card>
                    <CardHeader className="pb-4">
                        <CardTitle>Data da Rota</CardTitle>
                        <CardDescription>Selecione o dia para ver as rotas.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                         <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => setSelectedDate(d || new Date())}
                            className="w-full"
                            locale={ptBR}
                             components={{
                                DayContent: ({ date, ...props }) => {
                                    const agendamentosDoDia = agendamentosDoMotorista.filter(a => isSameDay(a.data, date));
                                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                                    
                                    return (
                                        <div className={cn(
                                            "h-full w-full p-1 flex flex-col items-start justify-start relative",
                                            isSelected && "bg-accent/20 rounded-md"
                                        )}>
                                            <time dateTime={date.toISOString()} className="text-sm">{format(date, 'd')}</time>
                                            {agendamentosDoDia.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {agendamentosDoDia.slice(0, 3).map(a => (
                                                        <div key={a.id} className={`w-1.5 h-1.5 rounded-full ${getBadgeClass(a.status)}`}></div>
                                                    ))}
                                                    {agendamentosDoDia.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></div>}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                            }}
                        />
                    </CardContent>
                </Card>
                {!isMotorista && (
                <Card>
                    <CardHeader>
                        <CardTitle>Motoristas</CardTitle>
                        <CardDescription>Selecione um motorista.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center items-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : motoristas.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {motoristas.map(m => (
                                    <Button 
                                        key={m} 
                                        variant={motoristaSelecionado === m ? 'default' : 'outline'}
                                        onClick={() => setMotoristaSelecionado(m)}
                                        className="w-full justify-start"
                                    >
                                        <Truck className="mr-2 h-4 w-4" />
                                        {m}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">Nenhum motorista com rotas cadastradas.</p>
                        )}
                    </CardContent>
                </Card>
                )}
            </div>

            <div className="md:col-span-8 lg:col-span-9">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>
                            {isMotorista ? `Minhas Operações` : `Operações de ${motoristaSelecionado || '...'}`}
                        </CardTitle>
                        <CardDescription>
                            Gerencie as operações do dia ou consulte o histórico.
                        </CardDescription>
                    </CardHeader>
                     <Tabs defaultValue="dia" className="flex flex-col flex-grow">
                        <TabsList className="mx-6">
                            <TabsTrigger value="dia">Operações do Dia</TabsTrigger>
                            <TabsTrigger value="historico">Histórico</TabsTrigger>
                        </TabsList>
                        <TabsContent value="dia" className="flex-grow">
                            <CardContent className="flex-grow p-0">
                                {loading ? (
                                    <div className="flex justify-center items-center h-full py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : !motoristaSelecionado && !isMotorista ? (
                                    <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                                        <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <h3 className="mt-4 text-lg font-semibold">Nenhum motorista selecionado</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Selecione um motorista para ver as operações.
                                        </p>
                                    </div>
                                ) : agendamentosDoDia.length === 0 ? (
                                    <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                                        <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <h3 className="mt-4 text-lg font-semibold">Nenhuma operação na rota</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Não há coletas pendentes ou em rota para {motoristaSelecionado} no dia {format(selectedDate, "dd/MM/yyyy")}.
                                        </p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-auto md:h-[calc(100vh-300px)]">
                                        <div className="space-y-4 p-6 pt-2">
                                            {agendamentosDoDia.map((coleta) => (
                                                <div key={coleta.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 transition-colors hover:bg-muted/50">
                                                    <div className="flex-grow cursor-pointer" onClick={() => handleViewDetails(coleta)}>
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h4 className="font-semibold">{coleta.cliente}</h4>
                                                            <Badge className={getBadgeClassForBadges(coleta.status)} variant="outline">{coleta.status}</Badge>
                                                            <Timer startTime={coleta.rota_iniciada_em} />
                                                        </div>
                                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                            <MapPin className="h-3.5 w-3.5"/>
                                                            <span>{coleta.origem?.endereco || 'N/A'}</span>
                                                            {coleta.destino && <ArrowRight className="h-3.5 w-3.5"/>}
                                                            {coleta.destino && <span>{coleta.destino.endereco}</span>}
                                                        </div>
                                                        {coleta.ajudante_nome && (
                                                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                                <User className="h-3.5 w-3.5"/>
                                                                <span>Ajudante: <span className="font-medium text-foreground">{coleta.ajudante_nome}</span></span>
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-semibold mt-2">
                                                            {format(coleta.data, "dd/MM/yyyy HH:mm")}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {coleta.status === 'Pendente' && (
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" variant="outline" onClick={() => setAgendamentoToStart(coleta)}>
                                                                    <Play className="h-4 w-4 mr-2" /> Iniciar Rota
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                        )}
                                                        {coleta.status === 'Em Rota' && (
                                                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(coleta, 'Pendente')}>
                                                                <Pause className="h-4 w-4 mr-2" /> Pausar
                                                            </Button>
                                                        )}
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setAgendamentoToUpdate({agendamento: coleta, status: 'Concluído'})}>
                                                                <Check className="h-4 w-4 mr-2" /> Concluir
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" variant="destructive" onClick={() => setAgendamentoToUpdate({agendamento: coleta, status: 'Cancelado'})}>
                                                                <X className="h-4 w-4 mr-2" /> Cancelar
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </TabsContent>
                        <TabsContent value="historico" className="flex-grow">
                             <CardContent className="flex-grow p-0">
                                {loading ? (
                                    <div className="flex justify-center items-center h-full py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : historicoAgendamentos.length === 0 ? (
                                     <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                                        <History className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <h3 className="mt-4 text-lg font-semibold">Nenhum histórico encontrado</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                           Não há operações concluídas ou canceladas para {motoristaSelecionado}.
                                        </p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-auto md:h-[calc(100vh-300px)]">
                                        <div className="space-y-4 p-6 pt-2">
                                            {historicoAgendamentos.map((coleta) => (
                                                <div key={coleta.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => handleViewDetails(coleta)}>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h4 className="font-semibold">{coleta.cliente}</h4>
                                                            <Badge className={getBadgeClassForBadges(coleta.status)} variant="outline">{coleta.status}</Badge>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                             <MapPin className="h-3.5 w-3.5"/>
                                                            <span>{coleta.origem?.endereco || 'N/A'}</span>
                                                            {coleta.destino && <ArrowRight className="h-3.5 w-3.5"/>}
                                                            {coleta.destino && <span>{coleta.destino.endereco}</span>}
                                                        </div>
                                                        <p className="text-sm font-semibold mt-1">
                                                            {format(coleta.data, "dd/MM/yyyy HH:mm")}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>
        </div>
        
        {agendamentoToUpdate && (
             <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar {agendamentoToUpdate.status === 'Concluído' ? 'Conclusão' : 'Cancelamento'}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Você tem certeza que deseja {agendamentoToUpdate.status === 'Concluído' ? 'concluir' : 'cancelar'} a operação para <span className="font-bold">{agendamentoToUpdate.agendamento.cliente}</span>?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setAgendamentoToUpdate(null)}>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={() => handleUpdateStatus(agendamentoToUpdate.agendamento, agendamentoToUpdate.status)}
                    className={agendamentoToUpdate.status === 'Cancelado' ? "bg-destructive hover:bg-destructive/90" : ""}
                    >
                        Sim, confirmo
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
        {agendamentoToStart && (
             <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Início de Rota</AlertDialogTitle>
                    <AlertDialogDescription>
                        Por favor, verifique se os detalhes da operação correspondem à nota fiscal antes de iniciar a rota para <span className="font-bold">{agendamentoToStart.cliente}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setAgendamentoToStart(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={() => handleUpdateStatus(agendamentoToStart, 'Em Rota')}
                    >
                        Sim, iniciar rota
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
        </AlertDialog>

        <JfabDetalhesOperacao 
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            agendamento={selectedAgendamento}
        />
    </>
    );
}
