// src/components/jfab_formulario_veiculo.tsx
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Veiculo } from '@/types/jfab_types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

const formSchema = z.object({
  id: z.string().optional(),
  modelo: z.string().min(2, { message: 'O modelo é obrigatório.' }),
  marca: z.string().min(2, { message: 'A marca é obrigatória.' }),
  ano: z.coerce.number().min(1950, { message: 'Ano inválido.' }).max(new Date().getFullYear() + 1, { message: 'Ano inválido.' }),
  placa: z.string().min(7, { message: 'A placa deve ter 7 caracteres.' }).max(7, { message: 'A placa deve ter 7 caracteres.' }),
  renavam: z.string().min(11, { message: 'O renavam deve ter 11 caracteres.' }).max(11, { message: 'O renavam deve ter 11 caracteres.' }),
  tipo: z.enum(['Caminhão', 'Carro', 'Moto', 'Van', 'Outro']),
  status: z.enum(['Disponível', 'Em Rota', 'Em Manutenção']),
});

type FormData = z.infer<typeof formSchema>;

export function JfabFormularioVeiculo({ isOpen, onClose, veiculo }: Props) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        status: 'Disponível',
        tipo: 'Caminhão',
    }
  });

  const statusValue = watch('status');

  useEffect(() => {
    if (isOpen) {
      if (veiculo) {
        reset(veiculo);
      } else {
        reset({
            modelo: '',
            marca: '',
            ano: new Date().getFullYear(),
            placa: '',
            renavam: '',
            tipo: 'Caminhão',
            status: 'Disponível',
        });
      }
    }
  }, [isOpen, veiculo, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (veiculo) {
        // Atualiza um veículo existente
        const docRef = doc(db, 'jfab_veiculos', veiculo.id);
        await setDoc(docRef, data, { merge: true });
        toast({ title: "Sucesso!", description: "Veículo atualizado." });
      } else {
        // Cria um novo veículo
        const newDocRef = doc(collection(db, 'jfab_veiculos'));
        await setDoc(newDocRef, { ...data, id: newDocRef.id });
        toast({ title: "Sucesso!", description: "Novo veículo cadastrado." });
      }
      onClose();
    } catch (error) {
      console.error("Erro ao salvar veículo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o veículo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{veiculo ? 'Editar Veículo' : 'Novo Veículo'}</SheetTitle>
          <SheetDescription>
            Preencha os detalhes do veículo abaixo.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-6">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input id="marca" {...register('marca')} />
                    {errors.marca && <p className="text-sm text-destructive">{errors.marca.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input id="modelo" {...register('modelo')} />
                    {errors.modelo && <p className="text-sm text-destructive">{errors.modelo.message}</p>}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="ano">Ano</Label>
                    <Input id="ano" type="number" {...register('ano')} />
                    {errors.ano && <p className="text-sm text-destructive">{errors.ano.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="placa">Placa</Label>
                    <Input id="placa" {...register('placa')} maxLength={7} />
                    {errors.placa && <p className="text-sm text-destructive">{errors.placa.message}</p>}
                </div>
            </div>
            
             <div className="grid gap-2">
                <Label htmlFor="renavam">Renavam</Label>
                <Input id="renavam" {...register('renavam')} maxLength={11} />
                {errors.renavam && <p className="text-sm text-destructive">{errors.renavam.message}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Select onValueChange={(value) => setValue('tipo', value as any)} value={watch('tipo')}>
                        <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Caminhão">Caminhão</SelectItem>
                        <SelectItem value="Carro">Carro</SelectItem>
                        <SelectItem value="Moto">Moto</SelectItem>
                        <SelectItem value="Van">Van</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.tipo && <p className="text-sm text-destructive">{errors.tipo.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setValue('status', value as any)} value={statusValue}>
                        <SelectTrigger className={statusValue === 'Em Manutenção' ? 'text-amber-600' : ''}>
                        <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Disponível">Disponível</SelectItem>
                        <SelectItem value="Em Rota">Em Rota</SelectItem>
                        <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                    {statusValue === 'Em Manutenção' && (
                        <p className="text-xs text-amber-600">
                            Para registrar uma manutenção, salve o status e use a opção 'Manutenções' na tela principal.
                        </p>
                    )}
                </div>
            </div>
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Veículo
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
