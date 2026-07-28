// src/components/jfab_formulario_usuario.tsx
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Usuario } from '@/types/jfab_types';
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
  usuario: Usuario | null;
}

const formSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(3, { message: 'O nome é obrigatório.' }),
  email: z.string().email({ message: 'E-mail inválido.' }),
  nivel: z.enum(['Administrador', 'Operador', 'Motorista', 'Cliente', 'Pendente']),
  telefone: z.string().optional(),
  pix: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function JfabFormularioUsuario({ isOpen, onClose, usuario }: Props) {
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
  });

  const nivel = watch('nivel');

  useEffect(() => {
    if (isOpen) {
      if (usuario) {
        reset(usuario);
      } else {
        reset({
          nome: '',
          email: '',
          nivel: 'Cliente',
          telefone: '',
          pix: '',
        });
      }
    }
  }, [isOpen, usuario, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const dataToSave = {...data};
      if (dataToSave.nivel !== 'Motorista') {
        dataToSave.pix = ''; // Limpa o pix se não for motorista
      }

      if (usuario) {
        // Atualiza um usuário existente
        const docRef = doc(db, 'jfab_usuarios', usuario.id);
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: "Sucesso!", description: "Usuário atualizado." });
      } else {
        // Cria um novo usuário
        const newDocRef = doc(collection(db, 'jfab_usuarios'));
        await setDoc(newDocRef, { ...dataToSave, id: newDocRef.id });
        toast({ title: "Sucesso!", description: "Novo usuário criado." });
      }
      onClose();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o usuário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{usuario ? 'Editar Usuário' : 'Novo Usuário'}</SheetTitle>
          <SheetDescription>
            Preencha os detalhes do usuário abaixo.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input id="nome" {...register('nome')} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone (Opcional)</Label>
              <Input id="telefone" {...register('telefone')} />
              {errors.telefone && <p className="text-sm text-destructive">{errors.telefone.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nivel">Nível de Acesso</Label>
              <Select onValueChange={(value) => setValue('nivel', value as any, { shouldValidate: true })} value={watch('nivel')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Operador">Operador</SelectItem>
                  <SelectItem value="Motorista">Motorista</SelectItem>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
              {errors.nivel && <p className="text-sm text-destructive">{errors.nivel.message}</p>}
            </div>

            {nivel === 'Motorista' && (
                <div className="grid gap-2">
                    <Label htmlFor="pix">Chave PIX (para pagamentos)</Label>
                    <Input id="pix" {...register('pix')} />
                    {errors.pix && <p className="text-sm text-destructive">{errors.pix.message}</p>}
                </div>
            )}

          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Usuário
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
