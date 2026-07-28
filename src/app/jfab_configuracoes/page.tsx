// src/app/jfab_configuracoes/page.tsx
"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { collection, query, doc, setDoc, getDoc, where, getDocs, writeBatch, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Usuario, ConfiguracaoDiaria, PagamentoMotorista } from '@/types/jfab_types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Calendar as CalendarIcon, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';


type FormValues = {
  diarias: { motoristaId: string; valor: number }[];
};

export default function JfabConfiguracoesPage() {
  const [motoristas, setMotoristas] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfWeek(new Date(), { locale: ptBR }),
      to: endOfWeek(new Date(), { locale: ptBR }),
  });
  const { toast } = useToast();
  
  const { register, handleSubmit, reset, formState: { isSubmitting, dirtyFields }, watch } = useForm<FormValues>();

  const carregarDados = useCallback(async () => {
    setLoading(true);
    // Carregar Motoristas
    const qMotoristas = query(collection(db, 'jfab_usuarios'), where('nivel', '==', 'Motorista'));
    const motoristasSnapshot = await getDocs(qMotoristas);
    const motoristasData = motoristasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
    setMotoristas(motoristasData);

    // Carregar Configurações de Diárias
    const configDocRef = doc(db, 'jfab_configuracoes', 'diarias_motoristas');
    const configDocSnap = await getDoc(configDocRef);
    
    let diariasData: { motoristaId: string; valor: number }[] = [];
    if (configDocSnap.exists()) {
      const config = configDocSnap.data() as ConfiguracaoDiaria;
      diariasData = motoristasData.map(motorista => {
        const diariaExistente = config.valores.find(d => d.motoristaId === motorista.id);
        return {
          motoristaId: motorista.id,
          valor: diariaExistente?.valor || 0,
        };
      });
    } else {
      diariasData = motoristasData.map(motorista => ({ motoristaId: motorista.id, valor: 0 }));
    }
    
    reset({ diarias: diariasData });
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);


  const onSubmit = async (data: FormValues) => {
    try {
      const configDocRef = doc(db, 'jfab_configuracoes', 'diarias_motoristas');
      const dadosParaSalvar: ConfiguracaoDiaria = {
        id: 'diarias_motoristas',
        valores: data.diarias.map(d => ({...d, valor: Number(d.valor) || 0}))
      };
      await setDoc(configDocRef, dadosParaSalvar);
      toast({ title: "Sucesso!", description: "Configurações salvas." });
      reset({}, { keepValues: true }); // Reseta o estado 'dirty'
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({ title: "Erro", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    }
  };

  const diariasForm = watch('diarias');
  const pagamentosSemanais = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !diariasForm) return [];
    
    const diasNoPeriodo = differenceInDays(dateRange.to, dateRange.from) + 1;
    if (diasNoPeriodo <= 0) return [];

    return motoristas.map((motorista, index) => {
      const diariaConfigurada = diariasForm[index];
      const valorDiaria = Number(diariaConfigurada?.valor || 0);
      const valorTotal = valorDiaria * diasNoPeriodo;
      return {
        motoristaId: motorista.id,
        nome: motorista.nome,
        pix: motorista.pix,
        valorDiaria: valorDiaria,
        diasTrabalhados: diasNoPeriodo,
        valorTotal: valorTotal,
      };
    });
  }, [motoristas, dateRange, diariasForm]);
  
  const handleGerarLancamentos = async () => {
    if (!dateRange?.from || pagamentosSemanais.length === 0) {
         toast({ title: "Atenção", description: "Selecione um período válido e verifique as diárias configuradas.", variant: "destructive" });
        return;
    }
    setGerando(true);
    const batch = writeBatch(db);
    let count = 0;
    
    pagamentosSemanais.forEach(p => {
        if (p.valorTotal > 0) {
            const newPagamentoRef = doc(collection(db, 'jfab_pagamentos_motoristas'));
            const novoPagamento: PagamentoMotorista = {
                id: newPagamentoRef.id,
                motoristaId: p.motoristaId,
                motoristaNome: p.nome,
                motoristaPix: p.pix,
                periodoInicio: dateRange.from!,
                periodoFim: dateRange.to!,
                diasTrabalhados: p.diasTrabalhados,
                valorDiaria: p.valorDiaria,
                valorTotal: p.valorTotal,
                status: 'Pendente',
                dataGeracao: new Date(),
            }
            batch.set(newPagamentoRef, novoPagamento);
            count++;
        }
    });

    try {
        await batch.commit();
        toast({ title: "Sucesso!", description: `${count} lançamentos de pagamento foram gerados.` });
    } catch (error) {
         console.error("Erro ao gerar lançamentos:", error);
         toast({ title: "Erro", description: "Não foi possível gerar os lançamentos.", variant: "destructive" });
    } finally {
        setGerando(false);
    }
  }


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie as configurações gerais e pagamentos do sistema.</p>
      </div>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
            <CardTitle>Diárias dos Motoristas</CardTitle>
            <CardDescription>Defina o valor padrão da diária para cada motorista. Este valor será usado para calcular os pagamentos semanais.</CardDescription>
            </CardHeader>
            <CardContent>
            {loading ? (
                <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-6">
                    {motoristas.map((motorista, index) => (
                    <div key={motorista.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg">
                        <Avatar className="h-12 w-12">
                        <AvatarFallback>{motorista.nome.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow text-center sm:text-left">
                            <p className="font-medium">{motorista.nome}</p>
                            <p className="text-sm text-muted-foreground">{motorista.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                        <Label htmlFor={`diaria-${motorista.id}`} className="text-lg font-semibold">R$</Label>
                        <Input
                            id={`diaria-${motorista.id}`}
                            type="number"
                            step="0.01"
                            className="w-40 text-lg h-12"
                            {...register(`diarias.${index}.valor`)}
                        />
                        <input type="hidden" {...register(`diarias.${index}.motoristaId`)} value={motorista.id} />
                        </div>
                    </div>
                    ))}
                </div>
            )}
            </CardContent>
             <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isSubmitting || !Object.keys(dirtyFields).length}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Diárias
                </Button>
              </CardFooter>
        </form>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>Gerador de Pagamento Semanal</CardTitle>
          <CardDescription>Selecione um período para calcular o pagamento semanal dos motoristas com base em suas diárias configuradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex flex-col sm:flex-row gap-4 items-center">
             <Popover>
                <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} - {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>) : (format(dateRange.from, "LLL dd, y", { locale: ptBR }))) : (<span>Selecione o período</span>)}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                </PopoverContent>
            </Popover>
            <Button onClick={handleGerarLancamentos} disabled={gerando || !dateRange?.from || !dateRange?.to}>
                {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                Gerar Lançamentos
            </Button>
           </div>
           <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Valor Diária</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Chave PIX</TableHead>
                        <TableHead className="text-right">Valor Total a Pagar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pagamentosSemanais.map((p) => (
                        <TableRow key={p.motoristaId}>
                            <TableCell className="font-medium">{p.nome}</TableCell>
                            <TableCell>R$ {p.valorDiaria.toFixed(2)}</TableCell>
                            <TableCell>{dateRange?.from && dateRange?.to ? `${differenceInDays(dateRange.to, dateRange.from) + 1} dias` : 'N/A'}</TableCell>
                             <TableCell className="font-mono text-xs">{p.pix || 'Não cadastrado'}</TableCell>
                            <TableCell className="text-right font-bold text-lg">R$ {p.valorTotal.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
