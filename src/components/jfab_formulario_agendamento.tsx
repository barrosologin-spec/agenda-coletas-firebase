// src/components/jfab_formulario_agendamento.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, doc, setDoc, Timestamp, serverTimestamp, query, where, getDocs, onSnapshot, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Agendamento, HistoricoItem, Usuario, Endereco, Veiculo, ConfiguracaoDiaria } from '@/types/jfab_types';
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Loader2, PlusCircle, Trash2, UploadCloud, UserPlus, DollarSign } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import type { User } from 'firebase/auth';
import { Progress } from './ui/progress';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agendamento: Agendamento | null;
}

const itemSchema = z.object({
  id: z.string().optional(),
  descricao: z.string().min(1, 'A descrição é obrigatória.'),
  quantidade: z.coerce.number().min(1, 'A quantidade deve ser no mínimo 1.'),
  pallets: z.coerce.number().optional(),
  peso: z.coerce.number().optional(),
});

const enderecoSchema = z.object({
    nome: z.string().min(1, 'O nome é obrigatório.'),
    endereco: z.string().min(1, 'O endereço é obrigatório.'),
});

const formSchema = z.object({
  cliente: z.string().min(1, { message: 'O nome do cliente contratante é obrigatório.' }),
  data: z.date({ required_error: 'A data e hora são obrigatórias.' }),
  motorista: z.string().min(1, { message: 'Selecione um motorista.' }),
  status: z.enum(['Pendente', 'Em Rota', 'Concluído', 'Cancelado']),
  tipo: z.enum(['Recebimento', 'Envio', 'Coleta']),
  notaFiscal: z.string().optional(),
  itens: z.array(itemSchema).min(1, { message: 'Adicione pelo menos um item.' }),
  observacoes: z.string().optional(),
  anexo: z.any().optional(), // Para o arquivo
  transportadora: z.string().optional(),
  veiculo: z.string().optional(),
  placa: z.string().optional(),
  origem: enderecoSchema,
  destino: enderecoSchema.optional(),
  ajudante_nome: z.string().optional(),
  ajudante_diaria_valor: z.coerce.number().optional(),
  ajudante_pix: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.ajudante_nome && (!data.ajudante_diaria_valor || data.ajudante_diaria_valor <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "O valor da diária é obrigatório se um ajudante for informado.",
            path: ["ajudante_diaria_valor"],
        });
    }
     if (data.ajudante_nome && !data.ajudante_pix) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A chave PIX é obrigatória se um ajudante for informado.",
            path: ["ajudante_pix"],
        });
    }
});


type FormData = z.infer<typeof formSchema>;

const createNotification = async (title: string, desc: string, paraUsuarioId: string | null = null) => {
  try {
    await addDoc(collection(db, 'jfab_notificacoes'), {
      title,
      desc,
      time: serverTimestamp(),
      read: false,
      arquivada: false,
      paraUsuarioId,
    });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
};

const compararEnderecos = (e1?: Endereco, e2?: Endereco) => {
    if (!e1 && !e2) return true;
    if (!e1 || !e2) return false;
    return e1.nome === e2.nome && e1.endereco === e2.endereco;
}

const gerarHistorico = (agendamentoAntigo: Agendamento | null, agendamentoNovo: Omit<FormData, 'anexo'>, usuario: string): HistoricoItem[] => {
    const historico: HistoricoItem[] = agendamentoAntigo?.historico?.map(h => ({...h, data: h.data})) || [];
    const agora = Timestamp.now();

    if (!agendamentoAntigo) {
        historico.push({ campo: 'Operação', de: null, para: 'Criado', data: agora.toDate(), usuario });
        return historico;
    }
    
    const nomesCampos: { [key in keyof Omit<FormData, 'anexo' | 'itens' | 'data' | 'origem' | 'destino'>]?: string } = {
        cliente: 'Cliente',
        motorista: 'Motorista',
        status: 'Status',
        tipo: 'Tipo',
        notaFiscal: 'Nota Fiscal',
        observacoes: 'Observações',
        transportadora: 'Transportadora',
        veiculo: 'Veículo',
        placa: 'Placa',
        ajudante_nome: 'Ajudante',
        ajudante_diaria_valor: 'Valor da Diária do Ajudante',
        ajudante_pix: 'PIX do Ajudante',
    };

    for (const key in nomesCampos) {
        const chave = key as keyof typeof nomesCampos;
        const nomeCampo = nomesCampos[chave]!;
        const valorAntigo = agendamentoAntigo[chave as keyof Agendamento];
        const valorNovo = agendamentoNovo[chave as keyof Omit<FormData, 'anexo' | 'itens' | 'data' | 'origem' | 'destino'>];
        
        if (String(valorAntigo || '') !== String(valorNovo || '')) {
            historico.push({ campo: nomeCampo, de: valorAntigo || 'Vazio', para: valorNovo || 'Vazio', data: agora.toDate(), usuario });
        }
    }
    
    if (agendamentoAntigo.data.getTime() !== agendamentoNovo.data.getTime()) {
        historico.push({ campo: 'Data', de: format(agendamentoAntigo.data, "dd/MM/yy HH:mm"), para: format(agendamentoNovo.data, "dd/MM/yy HH:mm"), data: agora.toDate(), usuario });
    }

    if (!compararEnderecos(agendamentoAntigo.origem, agendamentoNovo.origem)) {
         historico.push({ campo: 'Origem', de: `${agendamentoAntigo.origem?.nome} (${agendamentoAntigo.origem?.endereco})`, para: `${agendamentoNovo.origem.nome} (${agendamentoNovo.origem.endereco})`, data: agora.toDate(), usuario });
    }
    if (!compararEnderecos(agendamentoAntigo.destino, agendamentoNovo.destino)) {
         historico.push({ campo: 'Destino', de: agendamentoAntigo.destino ? `${agendamentoAntigo.destino.nome} (${agendamentoAntigo.destino.endereco})` : 'Vazio', para: agendamentoNovo.destino ? `${agendamentoNovo.destino.nome} (${agendamentoNovo.destino.endereco})` : 'Vazio', data: agora.toDate(), usuario });
    }

    // Simplificando o histórico de itens para evitar redundância
    const itensAntigosStr = JSON.stringify(agendamentoAntigo.itens.map(i => ({...i, id: undefined})));
    const itensNovosStr = JSON.stringify(agendamentoNovo.itens.map(i => ({...i, id: undefined})));

    if(itensAntigosStr !== itensNovosStr) {
        historico.push({ campo: 'Itens', de: `${agendamentoAntigo.itens.length} itens`, para: `${agendamentoNovo.itens.length} itens`, data: agora.toDate(), usuario });
    }

    return historico;
};

export function JfabFormularioAgendamento({ isOpen, onClose, agendamento }: Props) {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [motoristas, setMotoristas] = useState<Usuario[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
     
    const qMotoristas = query(collection(db, 'jfab_usuarios'), where('nivel', '==', 'Motorista'));
    const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
        const data: Usuario[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
        setMotoristas(data);
    });
    
    const qVeiculos = query(collection(db, 'jfab_veiculos'), where('status', '==', 'Disponível'));
    const unsubscribeVeiculos = onSnapshot(qVeiculos, (snapshot) => {
        const data: Veiculo[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veiculo));
        setVeiculos(data);
    });

    return () => {
        unsubscribeAuth();
        unsubscribeMotoristas();
        unsubscribeVeiculos();
    };
  }, []);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'Pendente',
      tipo: 'Recebimento',
      itens: [{ descricao: '', quantidade: 1, pallets: 0, peso: 0 }],
      origem: { nome: '', endereco: '' },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'itens',
  });

  const selectedDate = watch('data');
  const tipoOperacao = watch('tipo');
  const motoristaNome = watch('motorista');
  const selectedVehicle = watch('veiculo');
  const selectedPlaca = watch('placa');
  const motoristaSelecionado = motoristas.find(m => m.nome === motoristaNome);

  useEffect(() => {
    if (isOpen) {
      setUploadProgress(null);
      if (agendamento) {
        reset({
          ...agendamento,
          data: agendamento.data ? new Date(agendamento.data) : new Date(),
        });
      } else {
        reset({
          cliente: '',
          data: new Date(),
          motorista: '',
          status: 'Pendente',
          tipo: 'Recebimento',
          notaFiscal: '',
          itens: [{ descricao: '', quantidade: 1, pallets: 0, peso: 0 }],
          observacoes: '',
          transportadora: '',
          veiculo: '',
          placa: '',
          origem: { nome: '', endereco: '' },
          destino: undefined,
          ajudante_nome: '',
          ajudante_diaria_valor: 0,
          ajudante_pix: '',
        });
      }
    }
  }, [isOpen, agendamento, reset]);

  const handleFileUpload = (file: File): Promise<{ downloadURL: string, fileName: string }> => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `anexos/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Erro no upload:", error);
                toast({ title: "Erro de Upload", description: "Não foi possível enviar o anexo.", variant: "destructive" });
                setUploadProgress(null);
                reject(error);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    setUploadProgress(null);
                    resolve({ downloadURL, fileName: file.name });
                });
            }
        );
    });
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) {
       toast({ title: "Erro de Autenticação", description: "Usuário não está logado.", variant: "destructive" });
       return;
    }
    
    try {
      const q = query(collection(db, 'jfab_usuarios'), where('email', '==', currentUser.email));
      const userQuerySnapshot = await getDocs(q);
      const usuarioLogado = userQuerySnapshot.empty ? currentUser.email : userQuerySnapshot.docs[0].data().nome;

      
      const { anexo, ...formData } = data;
      let anexoUrl = agendamento?.anexoUrl || null;
      let anexoNome = agendamento?.anexoNome || null;
      
      if (anexo && anexo[0]) {
          const { downloadURL, fileName } = await handleFileUpload(anexo[0]);
          anexoUrl = downloadURL;
          anexoNome = fileName;
      }
      
      const agendamentoParaSalvar: any = { ...formData };

      if (formData.tipo !== 'Coleta') {
          delete agendamentoParaSalvar.destino;
      }

      // Adiciona o status da diária se houver ajudante
      if (formData.ajudante_nome && formData.ajudante_diaria_valor) {
          agendamentoParaSalvar.diaria_status = agendamento?.diaria_status || 'Pendente';
      } else {
          delete agendamentoParaSalvar.diaria_status;
      }


      const novoHistorico = gerarHistorico(agendamento, formData, usuarioLogado!);
      const motoristaSelecionado = motoristas.find(m => m.nome === data.motorista);

      const agendamentoData = {
          ...agendamentoParaSalvar,
          motoristaId: motoristaSelecionado?.id || null,
          data: Timestamp.fromDate(data.data), 
          historico: novoHistorico.map(h => ({...h, data: Timestamp.fromDate(h.data)})),
          anexoUrl,
          anexoNome
      };
      
      if (agendamento) {
        const docRef = doc(db, 'jfab_agendamentos', agendamento.id);
        await setDoc(docRef, agendamentoData, { merge: true });
        toast({ title: "Sucesso!", description: "Operação atualizada." });
        if(novoHistorico.length > (agendamento.historico?.length || 0)) {
           await createNotification("Operação Atualizada", `A operação para ${data.cliente} foi atualizada por ${usuarioLogado}.`);
        }
      } else {
        const newDoc = await addDoc(collection(db, 'jfab_agendamentos'), agendamentoData);
        toast({ title: "Sucesso!", description: "Nova operação criada." });
        
        // Notificação global para operadores
        await createNotification("Nova Operação", `Uma nova operação de ${data.tipo.toLowerCase()} foi criada para ${data.cliente} por ${usuarioLogado}.`);

        // Notificação específica para o motorista
        if (motoristaSelecionado) {
            await createNotification(
                "Nova Rota Atribuída",
                `Você foi atribuído a uma nova operação de ${data.tipo.toLowerCase()} para ${data.cliente} em ${format(data.data, "dd/MM/yyyy")}.`,
                motoristaSelecionado.id
            );
        }
      }
      onClose();
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a operação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const renderAddressFields = () => {
    switch (tipoOperacao) {
      case 'Recebimento':
        return (
          <div className="grid gap-4 p-4 border rounded-md">
            <h4 className="font-medium">Remetente</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="origem.nome">Nome do Remetente</Label>
                <Input id="origem.nome" {...register('origem.nome')} />
                {errors.origem?.nome && <p className="text-sm text-destructive">{errors.origem.nome.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="origem.endereco">Endereço do Remetente</Label>
                <Input id="origem.endereco" {...register('origem.endereco')} />
                {errors.origem?.endereco && <p className="text-sm text-destructive">{errors.origem.endereco.message}</p>}
              </div>
            </div>
          </div>
        );
      case 'Envio':
        return (
          <div className="grid gap-4 p-4 border rounded-md">
            <h4 className="font-medium">Destinatário</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="origem.nome">Nome do Destinatário</Label>
                <Input id="origem.nome" {...register('origem.nome')} />
                {errors.origem?.nome && <p className="text-sm text-destructive">{errors.origem.nome.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="origem.endereco">Endereço do Destinatário</Label>
                <Input id="origem.endereco" {...register('origem.endereco')} />
                {errors.origem?.endereco && <p className="text-sm text-destructive">{errors.origem.endereco.message}</p>}
              </div>
            </div>
          </div>
        );
      case 'Coleta':
        return (
            <div className="grid gap-6">
                <div className="grid gap-4 p-4 border rounded-md">
                    <h4 className="font-medium">Origem da Coleta</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="origem.nome">Nome na Origem</Label>
                            <Input id="origem.nome" {...register('origem.nome')} />
                             {errors.origem?.nome && <p className="text-sm text-destructive">{errors.origem.nome.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="origem.endereco">Endereço de Origem</Label>
                            <Input id="origem.endereco" {...register('origem.endereco')} />
                             {errors.origem?.endereco && <p className="text-sm text-destructive">{errors.origem.endereco.message}</p>}
                        </div>
                    </div>
                </div>
                 <div className="grid gap-4 p-4 border rounded-md">
                    <h4 className="font-medium">Destino da Entrega</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="destino.nome">Nome no Destino</Label>
                            <Input id="destino.nome" {...register('destino.nome')} />
                             {errors.destino?.nome && <p className="text-sm text-destructive">{errors.destino.nome.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="destino.endereco">Endereço de Destino</Label>
                            <Input id="destino.endereco" {...register('destino.endereco')} />
                             {errors.destino?.endereco && <p className="text-sm text-destructive">{errors.destino.endereco.message}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
      default:
        return null;
    }
  };


  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-3xl w-full flex flex-col">
        <SheetHeader>
            <SheetTitle>{agendamento ? 'Editar Operação' : 'Nova Operação'}</SheetTitle>
            <SheetDescription>
              Preencha os detalhes da operação abaixo.
            </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-grow overflow-y-auto pr-6 -mr-6">
          <div className="grid gap-6 py-6">
            
            <div className="grid gap-3">
              <Label>Tipo de Operação</Label>
               <RadioGroup 
                defaultValue={tipoOperacao}
                className="grid grid-cols-3 gap-4"
                onValueChange={(value) => setValue('tipo', value as 'Recebimento' | 'Envio' | 'Coleta', { shouldValidate: true })}
               >
                <div>
                  <RadioGroupItem value="Recebimento" id="r1" className="peer sr-only" />
                  <Label htmlFor="r1" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    Recebimento
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="Envio" id="r2" className="peer sr-only" />
                  <Label htmlFor="r2" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    Envio
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="Coleta" id="r3" className="peer sr-only" />
                  <Label htmlFor="r3" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                    Coleta
                  </Label>
                </div>
              </RadioGroup>
              {errors.tipo && <p className="text-sm text-destructive">{errors.tipo.message}</p>}
            </div>

            <Separator />
            
             <div className="grid gap-2">
                <Label htmlFor="cliente">Cliente Contratante</Label>
                <Input id="cliente" {...register('cliente')} placeholder="Quem está solicitando o serviço?"/>
                {errors.cliente && <p className="text-sm text-destructive">{errors.cliente.message}</p>}
            </div>

            {renderAddressFields()}
            
            <Separator />

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                  <Label htmlFor="data">Data e Hora</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                      <Button
                          variant={"outline"}
                          className={cn(
                          "justify-start text-left font-normal w-full",
                          !selectedDate && "text-muted-foreground"
                          )}
                      >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "dd/MM/yyyy HH:mm") : <span>Escolha uma data</span>}
                      </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => setValue('data', date || new Date(), { shouldValidate: true })}
                          initialFocus
                      />
                      <div className="p-3 border-t border-border">
                          <input
                              type="time"
                              className="w-full bg-transparent text-sm"
                              value={selectedDate ? format(selectedDate, "HH:mm") : ''}
                              onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(':').map(Number);
                                  const newDate = new Date(selectedDate || new Date());
                                  newDate.setHours(hours, minutes);
                                  setValue('data', newDate, { shouldValidate: true });
                              }}
                          />
                      </div>
                      </PopoverContent>
                  </Popover>
                  {errors.data && <p className="text-sm text-destructive">{errors.data.message}</p>}
              </div>

                <div className="grid gap-2">
                    <Label htmlFor="motorista">Motorista</Label>
                    <Select onValueChange={(value) => setValue('motorista', value, { shouldValidate: true })} value={motoristaNome}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um motorista" />
                        </SelectTrigger>
                        <SelectContent>
                            {motoristas.map(m => (
                                <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.motorista && <p className="text-sm text-destructive">{errors.motorista.message}</p>}
                </div>
            </div>
            
            <Separator />
            
            <div className="grid md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="transportadora">Transportadora (Opcional)</Label>
                    <Input id="transportadora" {...register('transportadora')} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="veiculo">Veículo (Opcional)</Label>
                    <Select onValueChange={(value) => {
                        const veiculo = veiculos.find(v => v.id === value);
                        setValue('veiculo', veiculo?.modelo || '', { shouldValidate: true });
                        setValue('placa', veiculo?.placa || '', { shouldValidate: true });
                    }} value={veiculos.find(v => v.placa === selectedPlaca)?.id}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um veículo disponível" />
                        </SelectTrigger>
                        <SelectContent>
                            {veiculos.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.modelo} - {v.placa}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="placa">Placa (Automática)</Label>
                    <Input id="placa" {...register('placa')} readOnly />
                </div>
            </div>

            <Separator />
            
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Itens da Operação</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `new_${fields.length}`, descricao: '', quantidade: 1, pallets: 0, peso: 0 })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
                </Button>
              </div>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_80px_80px_80px_auto] items-end gap-3 p-3 border rounded-lg bg-muted/50">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`itens.${index}.descricao`}>Descrição do Item</Label>
                      <Input id={`itens.${index}.descricao`} {...register(`itens.${index}.descricao`)} placeholder="Ex: Caixa de parafusos" />
                    </div>
                     <div className="grid gap-1.5">
                      <Label htmlFor={`itens.${index}.quantidade`}>Qtd.</Label>
                      <Input id={`itens.${index}.quantidade`} type="number" {...register(`itens.${index}.quantidade`)} />
                    </div>
                     <div className="grid gap-1.5">
                      <Label htmlFor={`itens.${index}.pallets`}>Pallets</Label>
                      <Input id={`itens.${index}.pallets`} type="number" {...register(`itens.${index}.pallets`)} />
                    </div>
                     <div className="grid gap-1.5">
                      <Label htmlFor={`itens.${index}.peso`}>Peso (kg)</Label>
                      <Input id={`itens.${index}.peso`} type="number" {...register(`itens.${index}.peso`)} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {errors.itens && <p className="text-sm text-destructive">{typeof errors.itens === 'string' ? errors.itens : errors.itens.message}</p>}
            </div>

            <Separator />
            
             <div className="p-4 border rounded-md">
                <h4 className="font-medium mb-4 flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary"/> Informações do Ajudante (Opcional)</h4>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="ajudante_nome">Nome do Ajudante</Label>
                        <Input id="ajudante_nome" {...register('ajudante_nome')} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="ajudante_diaria_valor">Valor da Diária (R$)</Label>
                        <Input id="ajudante_diaria_valor" type="number" step="0.01" {...register('ajudante_diaria_valor')} />
                        {errors.ajudante_diaria_valor && <p className="text-sm text-destructive">{errors.ajudante_diaria_valor.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="ajudante_pix">Chave PIX do Ajudante</Label>
                        <Input id="ajudante_pix" {...register('ajudante_pix')} />
                        {errors.ajudante_pix && <p className="text-sm text-destructive">{errors.ajudante_pix.message}</p>}
                    </div>
                </div>
            </div>

             <Separator />

             <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="notaFiscal">Nota Fiscal (Opcional)</Label>
                    <Input id="notaFiscal" {...register('notaFiscal')} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setValue('status', value as any, { shouldValidate: true })} value={watch('status')}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Em Rota">Em Rota</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                    </Select>
                    {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>
             </div>

            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações (Opcional)</Label>
              <Textarea id="observacoes" {...register('observacoes')} placeholder="Alguma instrução especial?" />
            </div>
            
            <Separator />

            <div className="grid gap-2">
                <Label htmlFor="anexo">Anexo (Opcional)</Label>
                 <Input id="anexo" type="file" {...register('anexo')} className="h-auto p-2" />
                 {agendamento?.anexoNome && !watch('anexo')?.[0] && (
                     <p className="text-sm text-muted-foreground">Anexo atual: {agendamento.anexoNome}</p>
                 )}
                 {uploadProgress !== null && (
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Enviando...</p>
                        <Progress value={uploadProgress} />
                    </div>
                 )}
            </div>
          </div>
          
          <SheetFooter className="mt-auto pt-4 sticky bottom-0 bg-background z-10">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting || uploadProgress !== null}>
              {(isSubmitting || uploadProgress !== null) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Operação
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
