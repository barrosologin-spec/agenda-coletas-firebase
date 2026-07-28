// src/components/jfab_manutencao_veiculo.tsx
"use client"

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Veiculo, Manutencao } from '@/types/jfab_types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Loader2, PlusCircle, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

const manutencaoSchema = z.object({
    id: z.string().optional(),
    descricao: z.string().min(5, 'A descrição é obrigatória.'),
    dataEntrada: z.date({ required_error: 'A data de entrada é obrigatória.' }),
    dataSaidaPrevista: z.date().optional(),
    custo: z.coerce.number().min(0.01, "O custo deve ser maior que zero."),
    oficina: z.string().optional(),
    oficina_pix: z.string().optional(),
});

type ManutencaoFormData = z.infer<typeof manutencaoSchema>;

const getPagamentoBadgeClass = (status?: string | null) => {
    switch (status) {
        case 'Pago':
            return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
        case 'Pendente':
            return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
        case 'Aprovado':
            return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30';
        default:
            return 'bg-muted';
    }
};

export function JfabManutencaoVeiculo({ isOpen, onClose, veiculo }: Props) {
  const { toast } = useToast();
  const [isFormVisible, setIsFormVisible] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ManutencaoFormData>({
    resolver: zodResolver(manutencaoSchema),
  });

  const selectedDate = watch('dataEntrada');

  const onSubmit = async (data: ManutencaoFormData) => {
    if (!veiculo) return;

    try {
      const novaManutencao: Manutencao = {
        ...data,
        id: `man_${Date.now()}`,
        concluida: false,
        status_pagamento: 'Pendente',
      };

      const veiculoRef = doc(db, 'jfab_veiculos', veiculo.id);
      await updateDoc(veiculoRef, {
        manutencoes: arrayUnion(novaManutencao),
        status: 'Em Manutenção' // Força o status para manutenção
      });
      
      toast({ title: "Sucesso!", description: "Nova manutenção registrada." });
      reset();
      setIsFormVisible(false);
    } catch (error) {
      console.error("Erro ao registrar manutenção:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a manutenção.",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleConcluida = async (manutencaoId: string, concluida: boolean) => {
    if (!veiculo) return;
    
    const novasManutencoes = (veiculo.manutencoes || []).map(m => {
        if (m.id === manutencaoId) {
            return { ...m, concluida: !concluida, dataSaidaReal: !concluida ? new Date() : undefined };
        }
        return m;
    });

    try {
        const veiculoRef = doc(db, 'jfab_veiculos', veiculo.id);
        await updateDoc(veiculoRef, {
            manutencoes: novasManutencoes
        });
        toast({ title: 'Sucesso!', description: `Manutenção marcada como ${!concluida ? 'concluída' : 'pendente'}.` });
    } catch (error) {
         console.error("Erro ao atualizar manutenção:", error);
         toast({ title: "Erro", description: "Não foi possível atualizar o status da manutenção.", variant: "destructive" });
    }
  }

  const historicoManutencoes = veiculo?.manutencoes?.sort((a,b) => b.dataEntrada.getTime() - a.dataEntrada.getTime()) || [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setIsFormVisible(false); reset(); } }}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Histórico de Manutenções</SheetTitle>
          <SheetDescription>
            Veículo: <span className="font-bold">{veiculo?.marca} {veiculo?.modelo} - {veiculo?.placa}</span>
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-grow flex flex-col min-h-0">
             <div className="py-4 border-b">
                {!isFormVisible ? (
                    <Button onClick={() => setIsFormVisible(true)} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Registrar Nova Manutenção
                    </Button>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-2">
                             <Label htmlFor="descricao">Descrição do Serviço</Label>
                             <Textarea id="descricao" {...register('descricao')} placeholder="Ex: Troca de óleo e filtros"/>
                             {errors.descricao && <p className="text-sm text-destructive">{errors.descricao.message}</p>}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="dataEntrada">Data de Entrada</Label>
                                 <Popover>
                                    <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn(!selectedDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "PPP", {locale: ptBR}) : <span>Escolha uma data</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => setValue('dataEntrada', d!)} initialFocus/></PopoverContent>
                                </Popover>
                                {errors.dataEntrada && <p className="text-sm text-destructive">{errors.dataEntrada.message}</p>}
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="dataSaidaPrevista">Previsão de Saída (Opcional)</Label>
                                <Input type="date" {...register('dataSaidaPrevista', { valueAsDate: true })} />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="custo">Custo (R$)</Label>
                                <Input id="custo" type="number" step="0.01" {...register('custo')} />
                                {errors.custo && <p className="text-sm text-destructive">{errors.custo.message}</p>}
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="oficina">Oficina (Opcional)</Label>
                                <Input id="oficina" {...register('oficina')} />
                            </div>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="oficina_pix">Chave PIX da Oficina (Opcional)</Label>
                            <Input id="oficina_pix" {...register('oficina_pix')} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => { setIsFormVisible(false); reset(); }}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <ScrollArea className="flex-1 mt-4 pr-6 -mr-6">
                <TooltipProvider>
                {historicoManutencoes.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        Nenhum registro de manutenção.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {historicoManutencoes.map((manut) => (
                             <div key={manut.id} className="text-sm p-4 border rounded-lg flex items-start gap-4">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex-shrink-0">
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="rounded-full h-8 w-8" 
                                                onClick={() => handleToggleConcluida(manut.id, manut.concluida)}
                                                disabled={manut.status_pagamento !== 'Pago'}
                                            >
                                                {manut.concluida ? <CheckCircle2 className="h-5 w-5 text-green-500"/> : <Circle className="h-5 w-5 text-muted-foreground"/>}
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {manut.status_pagamento !== 'Pago' && !manut.concluida && (
                                    <TooltipContent>
                                        <p>O pagamento deve estar como 'Pago' para concluir.</p>
                                    </TooltipContent>
                                    )}
                                </Tooltip>
                                <div className="flex-grow">
                                    <p className={cn("font-semibold", manut.concluida && "line-through text-muted-foreground")}>{manut.descricao}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Entrada em: <span className="font-medium">{format(manut.dataEntrada, 'dd/MM/yyyy')}</span>
                                        {manut.dataSaidaReal && ` | Saída em: ${format(manut.dataSaidaReal, 'dd/MM/yyyy')}`}
                                    </p>
                                    {manut.oficina && <p className="text-xs text-muted-foreground">Oficina: <span className="font-medium">{manut.oficina}</span></p>}
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    {manut.custo && <p className="font-bold">R$ {manut.custo.toFixed(2)}</p>}
                                    <Badge variant={'outline'} className={cn("whitespace-nowrap text-xs", getPagamentoBadgeClass(manut.status_pagamento))}>
                                        {manut.status_pagamento || 'N/A'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </TooltipProvider>
            </ScrollArea>
        </div>
        
        <SheetFooter className="mt-auto pt-4">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full">Fechar</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
