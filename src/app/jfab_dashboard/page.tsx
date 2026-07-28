// Página principal do sistema após o login.
// Apresenta um resumo visual das operações.
"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Agendamento } from '@/types/jfab_types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from "recharts"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Clock, CheckCircle, Truck, Loader2, Package, Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, Box } from 'lucide-react';
import { DateRange } from "react-day-picker"
import { format, startOfMonth, endOfMonth, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const jfab_chart_config_bar_dia = {
  operacoes: { label: "Operações", color: "hsl(var(--primary))" },
}

const jfab_chart_config_bar_motorista = {
  operacoes: { label: "Operações", color: "hsl(var(--accent))" },
}

const jfab_chart_config_pie = {
  Concluído: { label: 'Concluído', color: '#22c55e' },
  Pendente: { label: 'Pendente', color: '#f59e0b' },
  'Em Rota': { label: 'Em Rota', color: '#3b82f6' },
  Cancelado: { label: 'Cancelado', color: '#ef4444' },
};


export default function JfabDashboardPage() {
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [atividadesRecentes, setAtividadesRecentes] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });

     useEffect(() => {
        setLoading(true);
        
        // Query para atividades recentes (últimas 5)
        const qRecentes = query(
            collection(db, 'jfab_agendamentos'),
            orderBy('data', 'desc'),
            limit(5)
        );
        const unsubscribeRecentes = onSnapshot(qRecentes, (snapshot) => {
            const data: Agendamento[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                data: doc.data().data?.toDate()
            } as Agendamento));
            setAtividadesRecentes(data);
        });


        if (!dateRange?.from || !dateRange?.to) {
             setAgendamentos([]);
             setLoading(false);
             return;
        }

        // Query para dados do dashboard (com filtro de data)
        const qDashboard = query(
            collection(db, 'jfab_agendamentos'),
            where('data', '>=', Timestamp.fromDate(dateRange.from)),
            where('data', '<=', Timestamp.fromDate(dateRange.to))
        );
        const unsubscribeDashboard = onSnapshot(qDashboard, (querySnapshot) => {
            const data: Agendamento[] = [];
            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                data.push({ 
                    id: doc.id,
                    ...docData,
                    data: docData.data?.toDate()
                } as Agendamento);
            });
            setAgendamentos(data);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar agendamentos:", error);
            setLoading(false);
        });

        return () => {
            unsubscribeRecentes();
            unsubscribeDashboard();
        };
    }, [dateRange]);

    const resumo = React.useMemo(() => {
        const total = agendamentos.length;
        const concluidas = agendamentos.filter(a => a.status === 'Concluído').length;
        const pendentes = agendamentos.filter(a => a.status === 'Pendente').length;
        const emRota = agendamentos.filter(a => a.status === 'Em Rota').length;
        
        return [
            { title: 'Total de Operações', value: total.toString(), icon: Package },
            { title: 'Pendentes', value: pendentes.toString(), icon: Clock },
            { title: 'Concluídas', value: concluidas.toString(), icon: CheckCircle },
            { title: 'Em Rota', value: emRota.toString(), icon: Truck },
        ];
    }, [agendamentos]);

    const dadosGraficoStatus = React.useMemo(() => {
        const statusCounts: Record<string, number> = {};
        agendamentos.forEach(a => {
            statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        });

        return Object.entries(statusCounts)
            .map(([name, value]) => ({ 
                name, 
                value, 
                fill: jfab_chart_config_pie[name as keyof typeof jfab_chart_config_pie]?.color || '#8884d8'
            }))
            .filter(item => item.value > 0);
    }, [agendamentos]);

    const dadosGraficoDiario = React.useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];

        const operacoesPorDia: { [key: string]: number } = {};
        // Inicializa todos os dias no intervalo para garantir que eles apareçam no gráfico
        for (let d = new Date(dateRange.from); d <= dateRange.to; d.setDate(d.getDate() + 1)) {
            const diaFormatado = format(d, 'dd/MM');
            operacoesPorDia[diaFormatado] = 0;
        }

        agendamentos.forEach(a => {
            if (a.data) {
                const diaFormatado = format(a.data, 'dd/MM');
                if (diaFormatado in operacoesPorDia) {
                    operacoesPorDia[diaFormatado]++;
                }
            }
        });

        return Object.keys(operacoesPorDia).map(dia => ({
            dia,
            operacoes: operacoesPorDia[dia]
        }));
    }, [agendamentos, dateRange]);

    const dadosGraficoMotorista = React.useMemo(() => {
        const operacoesPorMotorista: Record<string, number> = {};
        agendamentos.forEach(a => {
            if (a.motorista) {
                operacoesPorMotorista[a.motorista] = (operacoesPorMotorista[a.motorista] || 0) + 1;
            }
        });

        return Object.entries(operacoesPorMotorista)
            .map(([motorista, operacoes]) => ({ motorista, operacoes }))
            .sort((a, b) => b.operacoes - a.operacoes); // Ordena do maior para o menor
    }, [agendamentos]);


  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <div className="flex items-center gap-2">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className="w-full sm:w-[300px] justify-start text-left font-normal"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                            </>
                        ) : (
                            format(dateRange.from, "LLL dd, y", { locale: ptBR })
                        )
                        ) : (
                        <span>Escolha uma data</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={ptBR}
                    />
                    </PopoverContent>
                </Popover>
            </div>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {resumo.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
       ) : (
        <>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Operações por Dia</CardTitle>
                        <CardDescription>Total de operações por dia no período selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ChartContainer config={jfab_chart_config_bar_dia} className="h-[300px] w-full">
                            <BarChart accessibilityLayer data={dadosGraficoDiario}>
                                <CartesianGrid vertical={false} />
                                <XAxis 
                                    dataKey="dia" 
                                    tickLine={false} 
                                    tickMargin={10} 
                                    axisLine={false} 
                                    tickFormatter={(value) => value.substring(0,5)}
                                />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Bar dataKey="operacoes" fill="var(--color-operacoes)" radius={8} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Distribuição de Status</CardTitle>
                        <CardDescription>Visão geral do status de todas as operações no período.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                        <ChartContainer config={jfab_chart_config_pie} className="mx-auto aspect-square h-[250px]">
                            <PieChart>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Pie data={dadosGraficoStatus} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                    {dadosGraficoStatus.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background hover:opacity-80" />
                                    ))}
                                </Pie>
                                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                 <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Desempenho por Motorista</CardTitle>
                        <CardDescription>Número de operações por motorista no período.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={jfab_chart_config_bar_motorista} className="h-[300px] w-full">
                            <BarChart data={dadosGraficoMotorista} layout="vertical" margin={{left: 10}}>
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" dataKey="operacoes" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="motorista" 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickMargin={10}
                                    width={80}
                                    tickFormatter={value => value.length > 10 ? `${value.substring(0,10)}...` : value}
                                />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Bar dataKey="operacoes" fill="var(--color-operacoes)" radius={5} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Atividade Recente</CardTitle>
                        <CardDescription>As últimas 5 operações cadastradas no sistema.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {atividadesRecentes.map((op) => (
                                <div key={op.id} className="flex items-center gap-4">
                                     <Avatar className="hidden h-9 w-9 sm:flex">
                                        <AvatarFallback>
                                             {op.tipo === 'Recebimento' ? <ArrowDownLeft className="h-4 w-4" /> : 
                                              (op.tipo === 'Envio' ? <ArrowUpRight className="h-4 w-4" /> : <Box className="h-4 w-4" />)
                                             }
                                        </AvatarFallback>
                                     </Avatar>
                                     <div className="grid gap-1">
                                        <Link href={`/jfab_agendamentos?id=${op.id}`} className="font-medium hover:underline">
                                            {op.cliente}
                                        </Link>
                                        <p className="text-sm text-muted-foreground">{op.tipo} para {op.motorista}</p>
                                     </div>
                                     <p className="ml-auto text-sm text-muted-foreground">
                                        {formatDistanceToNow(op.data, { addSuffix: true, locale: ptBR })}
                                     </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
       )}
    </div>
  );
}
