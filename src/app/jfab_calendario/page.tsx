// src/app/jfab_calendario/page.tsx
"use client"
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Agendamento } from '@/types/jfab_types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, ArrowDownLeft, ArrowUpRight, Calendar as CalendarIcon, Box } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { JfabDetalhesOperacao } from '@/components/jfab_detalhes_operacao';


export default function JfabCalendarioPage() {
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);

    useEffect(() => {
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
                    historico: historico.sort((a, b) => b.data.getTime() - a.data.getTime()),
                    rota_iniciada_em: docData.rota_iniciada_em?.toDate(),
                    rota_finalizada_em: docData.rota_finalizada_em?.toDate(),
                } as Agendamento
            });
            setAgendamentos(data);
            setLoading(false);
        }, error => {
            console.error("Erro ao buscar agendamentos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleViewDetails = (agendamento: Agendamento) => {
        setSelectedAgendamento(agendamento);
        setIsDetailsOpen(true);
    }

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
    
    const agendamentosDoDia = (selectedDate ? agendamentos.filter(a => isSameDay(a.data, selectedDate)) : []).sort((a,b) => a.data.getTime() - b.data.getTime());
    
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

    return (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card>
                    <CardContent className="p-0 sm:p-2">
                         <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="w-full"
                            locale={ptBR}
                            components={{
                                DayContent: ({ date, ...props }) => {
                                    const agendamentosDoDia = agendamentos.filter(a => isSameDay(a.data, date));
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
            </div>
            <div className="md:col-span-1">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>
                            Operações para {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : 'Nenhuma data selecionada'}
                        </CardTitle>
                        <CardDescription>
                            {agendamentosDoDia.length} {agendamentosDoDia.length === 1 ? 'operação agendada' : 'operações agendadas'}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow p-0">
                        <ScrollArea className="h-auto md:h-[calc(100vh-240px)] px-6 pb-6">
                            {loading ? (
                                <div className="flex justify-center items-center py-10 h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : agendamentosDoDia.length > 0 ? (
                                <div className="space-y-4">
                                {agendamentosDoDia.map(agendamento => (
                                    <button key={agendamento.id} onClick={() => handleViewDetails(agendamento)} className="w-full text-left p-3 rounded-lg border bg-card/50 hover:bg-muted transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{agendamento.cliente}</p>
                                                <p className="text-xs text-muted-foreground">{agendamento.motorista}</p>
                                            </div>
                                            <Badge variant="outline" className={`text-xs ${getBadgeClassForBadges(agendamento.status)}`}>{agendamento.status}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                                             <div className='flex items-center gap-1.5'>
                                                {agendamento.tipo === 'Recebimento' ? 
                                                  <ArrowDownLeft className="h-3 w-3 text-blue-500" /> : 
                                                  (agendamento.tipo === 'Envio' ?
                                                    <ArrowUpRight className="h-3 w-3 text-emerald-500" /> :
                                                    <Box className="h-3 w-3 text-purple-500" />
                                                  )
                                                }
                                                <span>{agendamento.tipo}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                <span>{format(agendamento.data, "HH:mm")}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center h-full py-10">
                                    <CalendarIcon className="h-12 w-12 text-muted-foreground/50" />
                                    <p className="mt-4 text-sm text-muted-foreground">
                                        Nenhuma operação para esta data.
                                    </p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>

        <JfabDetalhesOperacao 
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            agendamento={selectedAgendamento}
        />
        </>
    );
}
