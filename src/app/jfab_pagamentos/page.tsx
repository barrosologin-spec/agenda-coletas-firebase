
// Página para administradores e operadores gerenciarem o pagamento de diárias de ajudantes.
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp, arrayUnion, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Agendamento, Usuario, Veiculo, Manutencao, PagamentoMotorista } from '@/types/jfab_types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Send, Clipboard, ClipboardCheck, ChevronsUpDown, ArrowUp, ArrowDown, DollarSign, FilterX, Calendar as CalendarIcon, Banknote, Hourglass, Pencil, Trash2, Car, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { User as FirebaseUser } from 'firebase/auth';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { JfabFormularioAgendamento } from '@/components/jfab_formulario_agendamento';
import { JfabDetalhesOperacao } from '@/components/jfab_detalhes_operacao';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type SortKeyAjudante = 'data' | 'ajudante_nome' | 'ajudante_diaria_valor';
type SortKeyManutencao = 'dataEntrada' | 'modelo' | 'custo';
type SortKeyMotorista = 'dataGeracao' | 'motoristaNome' | 'valorTotal';

type DialogAction = 
    | { type: 'UPDATE_DIARIA_AJUDANTE_STATUS'; operacao: Agendamento; status: 'Aprovado' | 'Pago' }
    | { type: 'DELETE_DIARIA_AJUDANTE'; operacao: Agendamento }
    | { type: 'UPDATE_MANUTENCAO_STATUS'; veiculo: Veiculo; manutencao: Manutencao, status: 'Aprovado' | 'Pago' }
    | { type: 'UPDATE_PAGAMENTO_MOTORISTA_STATUS'; pagamento: PagamentoMotorista, status: 'Aprovado' | 'Pago' };

const getDiariaBadgeClass = (status?: string | null) => {
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

const copyToClipboard = (pix: string | undefined, toast: (options: any) => void) => {
      if (!pix) return;
      navigator.clipboard.writeText(pix).then(() => {
          toast({ title: "PIX Copiado!", description: "A chave PIX foi copiada para a área de transferência." });
      });
  }


// --- Componente para a aba de Diárias de Ajudantes ---
function TabDiariasAjudantes({ userProfile, setDialogAction }: { userProfile: Usuario | null, setDialogAction: (action: DialogAction) => void }) {
    const [operacoes, setOperacoes] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedPix, setCopiedPix] = useState<string | null>(null);
    const { toast } = useToast();
    
    // State for filters and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [sortKey, setSortKey] = useState<SortKeyAjudante>('data');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // State for modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedOperacao, setSelectedOperacao] = useState<Agendamento | null>(null);

    useEffect(() => {
        const qOperacoes = query(
          collection(db, 'jfab_agendamentos'), 
          where('ajudante_diaria_valor', '>', 0)
        );

        const unsubscribeOperacoes = onSnapshot(qOperacoes, (snapshot) => {
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
                } as Agendamento;
             });
             setOperacoes(data);
             setLoading(false);
        }, error => {
            console.error("Erro ao buscar operações com ajudante:", error);
            setLoading(false);
        });

        return () => unsubscribeOperacoes();
    }, []);

    const filteredAndSortedOperacoes = useMemo(() => {
        let filtered = operacoes.filter(item => {
            const itemDate = item.data;
            const isInDateRange = dateRange?.from && dateRange?.to ? itemDate >= dateRange.from && itemDate <= dateRange.to : true;
            const searchMatch = searchTerm ? item.ajudante_nome?.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            const statusMatch = statusFilter ? item.diaria_status === statusFilter : true;
            return isInDateRange && searchMatch && statusMatch;
        });

        return filtered.sort((a, b) => {
          const aValue = a[sortKey];
          const bValue = b[sortKey];

          if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return 0;
          
          let comparison = 0;
          if (aValue instanceof Date && bValue instanceof Date) {
              comparison = aValue.getTime() - bValue.getTime();
          } else if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue);
          } else if (typeof aValue === 'number' && typeof bValue === 'number') {
              comparison = aValue - bValue;
          }

          return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [operacoes, searchTerm, statusFilter, dateRange, sortKey, sortDirection]);

    const summary = useMemo(() => {
        return filteredAndSortedOperacoes.reduce((acc, op) => {
          const valor = op.ajudante_diaria_valor || 0;
          if (op.diaria_status === 'Pago') {
            acc.pago += valor;
          } else if (op.diaria_status === 'Aprovado') {
            acc.aprovado += valor;
          } else if (op.diaria_status === 'Pendente') {
            acc.pendente += valor;
          }
          return acc;
        }, { pago: 0, aprovado: 0, pendente: 0 });
    }, [filteredAndSortedOperacoes]);

    const handleSort = (key: SortKeyAjudante) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKeyAjudante) => {
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    }
    
    const handleEditOperacao = (operacao: Agendamento) => {
        setSelectedOperacao(operacao);
        setIsFormOpen(true);
    }

    const handleViewDetails = (operacao: Agendamento) => {
        setSelectedOperacao(operacao);
        setIsDetailsOpen(true);
    }
    
    const localCopyToClipboard = (pix: string) => {
        copyToClipboard(pix, toast);
        setCopiedPix(pix);
        setTimeout(() => setCopiedPix(null), 2000);
    }

    const isAdmin = userProfile?.nivel === 'Administrador';
    const isOperator = userProfile?.nivel === 'Operador';
    
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pago (período)</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">R$ {summary.pago.toFixed(2)}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aguardando Pagamento</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">R$ {summary.aprovado.toFixed(2)}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendente Aprovação</CardTitle>
                        <Hourglass className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">R$ {summary.pendente.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pagamentos de Diárias</CardTitle>
                    <CardDescription>Aprove e confirme o pagamento das diárias dos ajudantes.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col gap-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <Input 
                                placeholder="Buscar por ajudante..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="md:col-span-2"
                            />
                             <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === 'todos-status' ? '' : value)}>
                                <SelectTrigger><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos-status">Todos os Status</SelectItem>
                                    <SelectItem value="Pendente">Pendente</SelectItem>
                                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                                    <SelectItem value="Pago">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className="justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} - {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>) : (format(dateRange.from, "LLL dd, y", { locale: ptBR }))) : (<span>Escolha uma data</span>)}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                                </PopoverContent>
                            </Popover>
                        </div>
                         <Button variant="outline" onClick={handleResetFilters} className="flex items-center gap-2 max-w-min"><FilterX className="h-4 w-4" />Limpar</Button>
                    </div>

                    {loading ? (
                      <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Carregando...</p></div>
                    ) : (
                      <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('data')}>Data {renderSortIcon('data')}</button></TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>ID Operação</TableHead>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('ajudante_nome')}>Ajudante {renderSortIcon('ajudante_nome')}</button></TableHead>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('ajudante_diaria_valor')}>Valor Diária {renderSortIcon('ajudante_diaria_valor')}</button></TableHead>
                            <TableHead>Chave PIX</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndSortedOperacoes.map((item) => (
                            <TableRow key={item.id} >
                              <TableCell className="cursor-pointer" onClick={() => handleViewDetails(item)}>{format(item.data, 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="font-medium cursor-pointer" onClick={() => handleViewDetails(item)}>{item.cliente}</TableCell>
                              <TableCell className="font-mono text-xs cursor-pointer" onClick={() => handleViewDetails(item)}>{item.id.substring(0, 7).toUpperCase()}</TableCell>
                              <TableCell className="font-medium">{item.ajudante_nome}</TableCell>
                              <TableCell>R$ {item.ajudante_diaria_valor?.toFixed(2)}</TableCell>
                              <TableCell>
                                {item.ajudante_pix &&
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs">{item.ajudante_pix}</span>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); localCopyToClipboard(item.ajudante_pix!)}}>
                                      {copiedPix === item.ajudante_pix ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                }
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(getDiariaBadgeClass(item.diaria_status))}>{item.diaria_status || 'N/A'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {isAdmin && (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditOperacao(item)}><Pencil className="h-4 w-4" /></Button>
                                       <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDialogAction({type: 'DELETE_DIARIA_AJUDANTE', operacao: item})}><Trash2 className="h-4 w-4" /></Button>
                                      </AlertDialogTrigger>
                                    </>
                                  )}
                                  {isAdmin && item.diaria_status === 'Pendente' && (
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" onClick={() => setDialogAction({type: 'UPDATE_DIARIA_AJUDANTE_STATUS', operacao: item, status: 'Aprovado'})}><Check className="mr-2 h-4 w-4" /> Aprovar</Button>
                                      </AlertDialogTrigger>
                                  )}
                                  {(isAdmin || isOperator) && item.diaria_status === 'Aprovado' && (
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setDialogAction({type: 'UPDATE_DIARIA_AJUDANTE_STATUS', operacao: item, status: 'Pago'})}><Send className="mr-2 h-4 w-4" /> Pagar</Button>
                                      </AlertDialogTrigger>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    )}
                </CardContent>
            </Card>

            <JfabFormularioAgendamento isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} agendamento={selectedOperacao} />
            <JfabDetalhesOperacao isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} agendamento={selectedOperacao} />
        </div>
    );
}

// --- Componente para a aba de Pagamentos de Manutenção ---
function TabManutencoes({ userProfile, setDialogAction }: { userProfile: Usuario | null, setDialogAction: (action: DialogAction) => void }) {
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedPix, setCopiedPix] = useState<string | null>(null);
    const { toast } = useToast();

    // State for filters and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [sortKey, setSortKey] = useState<SortKeyManutencao>('dataEntrada');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const qVeiculos = query(collection(db, 'jfab_veiculos'));
        const unsubscribe = onSnapshot(qVeiculos, (snapshot) => {
            const data: Veiculo[] = snapshot.docs.map(doc => ({
                 id: doc.id,
                 ...doc.data(),
                 manutencoes: (doc.data().manutencoes || []).map((m: any) => ({
                    ...m,
                    dataEntrada: m.dataEntrada.toDate(),
                 }))
            } as Veiculo)).filter(v => v.manutencoes && v.manutencoes.some(m => m.custo && m.custo > 0));
            setVeiculos(data);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar veículos com manutenção:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const pagamentosManutencao = useMemo(() => {
        return veiculos.flatMap(v => 
            (v.manutencoes || []).filter(m => m.custo && m.custo > 0).map(m => ({ veiculo: v, manutencao: m }))
        );
    }, [veiculos]);

    const filteredAndSortedManutencoes = useMemo(() => {
        let filtered = pagamentosManutencao.filter(({ veiculo, manutencao }) => {
            const itemDate = manutencao.dataEntrada;
            const isInDateRange = dateRange?.from && dateRange?.to ? itemDate >= dateRange.from && itemDate <= dateRange.to : true;
            const searchMatch = searchTerm ? 
                (veiculo.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 veiculo.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 manutencao.oficina?.toLowerCase().includes(searchTerm.toLowerCase()))
                : true;
            const statusMatch = statusFilter ? manutencao.status_pagamento === statusFilter : true;
            return isInDateRange && searchMatch && statusMatch;
        });

        return filtered.sort((a, b) => {
            const aValue = a.manutencao[sortKey as keyof Manutencao] || a.veiculo[sortKey as keyof Veiculo];
            const bValue = b.manutencao[sortKey as keyof Manutencao] || b.veiculo[sortKey as keyof Veiculo];
            
            if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return 0;
            
            let comparison = 0;
            if (aValue instanceof Date && bValue instanceof Date) {
                comparison = aValue.getTime() - bValue.getTime();
            } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [pagamentosManutencao, searchTerm, statusFilter, dateRange, sortKey, sortDirection]);

     const summary = useMemo(() => {
        return filteredAndSortedManutencoes.reduce((acc, { manutencao }) => {
          const valor = manutencao.custo || 0;
          if (manutencao.status_pagamento === 'Pago') {
            acc.pago += valor;
          } else if (manutencao.status_pagamento === 'Aprovado') {
            acc.aprovado += valor;
          } else if (manutencao.status_pagamento === 'Pendente') {
            acc.pendente += valor;
          }
          return acc;
        }, { pago: 0, aprovado: 0, pendente: 0 });
    }, [filteredAndSortedManutencoes]);

    const handleSort = (key: SortKeyManutencao) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key as any);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKeyManutencao) => {
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const localCopyToClipboard = (pix: string | undefined) => {
        copyToClipboard(pix, toast);
        setCopiedPix(pix || null);
        setTimeout(() => setCopiedPix(null), 2000);
    }
    
    const isAdmin = userProfile?.nivel === 'Administrador';
    const isOperator = userProfile?.nivel === 'Operador';

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Pago (período)</CardTitle><Banknote className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">R$ {summary.pago.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Aguardando Pagamento</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-600">R$ {summary.aprovado.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pendente Aprovação</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-yellow-600">R$ {summary.pendente.toFixed(2)}</div></CardContent>
                </Card>
            </div>
            <Card>
                 <CardHeader>
                    <CardTitle>Pagamentos de Manutenção</CardTitle>
                    <CardDescription>Aprove e confirme o pagamento dos serviços de manutenção da frota.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col gap-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                             <Input placeholder="Buscar por veículo ou oficina..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:col-span-2"/>
                             <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === 'todos-status' ? '' : value)}>
                                <SelectTrigger><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos-status">Todos os Status</SelectItem>
                                    <SelectItem value="Pendente">Pendente</SelectItem>
                                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                                    <SelectItem value="Pago">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className="justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} - {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>) : (format(dateRange.from, "LLL dd, y", { locale: ptBR }))) : (<span>Escolha uma data</span>)}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/></PopoverContent>
                            </Popover>
                        </div>
                        <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter(''); setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }); }} className="flex items-center gap-2 max-w-min"><FilterX className="h-4 w-4" />Limpar</Button>
                     </div>
                     {loading ? (
                         <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Carregando...</p></div>
                     ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead><button className="flex items-center" onClick={() => handleSort('dataEntrada')}>Data {renderSortIcon('dataEntrada')}</button></TableHead>
                                        <TableHead><button className="flex items-center" onClick={() => handleSort('modelo')}>Veículo {renderSortIcon('modelo')}</button></TableHead>
                                        <TableHead>Serviço</TableHead>
                                        <TableHead>Oficina</TableHead>
                                        <TableHead><button className="flex items-center" onClick={() => handleSort('custo')}>Custo {renderSortIcon('custo')}</button></TableHead>
                                        <TableHead>Chave PIX</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedManutencoes.map(({ veiculo, manutencao }) => (
                                        <TableRow key={manutencao.id}>
                                            <TableCell>{format(manutencao.dataEntrada, 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="font-medium">{veiculo.marca} {veiculo.modelo} ({veiculo.placa})</TableCell>
                                            <TableCell>{manutencao.descricao}</TableCell>
                                            <TableCell>{manutencao.oficina || 'N/A'}</TableCell>
                                            <TableCell>R$ {manutencao.custo?.toFixed(2) || '0.00'}</TableCell>
                                            <TableCell>
                                                {manutencao.oficina_pix && 
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs">{manutencao.oficina_pix}</span>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => localCopyToClipboard(manutencao.oficina_pix)}>
                                                            {copiedPix === manutencao.oficina_pix ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                }
                                            </TableCell>
                                            <TableCell><Badge variant="outline" className={cn(getDiariaBadgeClass(manutencao.status_pagamento))}>{manutencao.status_pagamento || 'N/A'}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                     {isAdmin && manutencao.status_pagamento === 'Pendente' && (
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" onClick={() => setDialogAction({type: 'UPDATE_MANUTENCAO_STATUS', veiculo, manutencao, status: 'Aprovado'})}><Check className="mr-2 h-4 w-4" /> Aprovar</Button>
                                                        </AlertDialogTrigger>
                                                     )}
                                                     {(isAdmin || isOperator) && manutencao.status_pagamento === 'Aprovado' && (
                                                         <AlertDialogTrigger asChild>
                                                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setDialogAction({type: 'UPDATE_MANUTENCAO_STATUS', veiculo, manutencao, status: 'Pago'})}><Send className="mr-2 h-4 w-4" /> Pagar</Button>
                                                        </AlertDialogTrigger>
                                                     )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
    )
}

// --- Componente para a aba de Diárias de Motoristas ---
function TabDiariasMotoristas({ userProfile, setDialogAction }: { userProfile: Usuario | null, setDialogAction: (action: DialogAction) => void }) {
    const [pagamentos, setPagamentos] = useState<PagamentoMotorista[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedPix, setCopiedPix] = useState<string | null>(null);
    const { toast } = useToast();
    
    // State for filters and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [sortKey, setSortKey] = useState<SortKeyMotorista>('dataGeracao');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    
    useEffect(() => {
        const qPagamentos = query(collection(db, 'jfab_pagamentos_motoristas'));

        const unsubscribePagamentos = onSnapshot(qPagamentos, (snapshot) => {
             const data: PagamentoMotorista[] = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    ...docData,
                    periodoInicio: docData.periodoInicio.toDate(),
                    periodoFim: docData.periodoFim.toDate(),
                    dataGeracao: docData.dataGeracao.toDate(),
                } as PagamentoMotorista;
             });
             setPagamentos(data);
             setLoading(false);
        }, error => {
            console.error("Erro ao buscar pagamentos de motoristas:", error);
            setLoading(false);
        });

        return () => unsubscribePagamentos();
    }, []);

    const filteredAndSortedPagamentos = useMemo(() => {
        let filtered = pagamentos.filter(item => {
            const itemDate = item.dataGeracao;
            const isInDateRange = dateRange?.from && dateRange?.to ? itemDate >= dateRange.from && itemDate <= dateRange.to : true;
            const searchMatch = searchTerm ? item.motoristaNome?.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            const statusMatch = statusFilter ? item.status === statusFilter : true;
            return isInDateRange && searchMatch && statusMatch;
        });

        return filtered.sort((a, b) => {
          const aValue = a[sortKey];
          const bValue = b[sortKey];

          if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return 0;
          
          let comparison = 0;
          if (aValue instanceof Date && bValue instanceof Date) {
              comparison = aValue.getTime() - bValue.getTime();
          } else if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue);
          } else if (typeof aValue === 'number' && typeof bValue === 'number') {
              comparison = aValue - bValue;
          }

          return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [pagamentos, searchTerm, statusFilter, dateRange, sortKey, sortDirection]);

    const summary = useMemo(() => {
        return filteredAndSortedPagamentos.reduce((acc, op) => {
          const valor = op.valorTotal || 0;
          if (op.status === 'Pago') {
            acc.pago += valor;
          } else if (op.status === 'Aprovado') {
            acc.aprovado += valor;
          } else if (op.status === 'Pendente') {
            acc.pendente += valor;
          }
          return acc;
        }, { pago: 0, aprovado: 0, pendente: 0 });
    }, [filteredAndSortedPagamentos]);

    const handleSort = (key: SortKeyMotorista) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKeyMotorista) => {
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const localCopyToClipboard = (pix: string | undefined) => {
        copyToClipboard(pix, toast);
        setCopiedPix(pix);
        setTimeout(() => setCopiedPix(null), 2000);
    }
    
    const isAdmin = userProfile?.nivel === 'Administrador';
    const isOperator = userProfile?.nivel === 'Operador';
    
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Pago (período)</CardTitle><Banknote className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">R$ {summary.pago.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Aguardando Pagamento</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-600">R$ {summary.aprovado.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pendente Aprovação</CardTitle><Hourglass className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-yellow-600">R$ {summary.pendente.toFixed(2)}</div></CardContent>
                </Card>
            </div>
            <Card>
                 <CardHeader>
                    <CardTitle>Pagamentos de Motoristas (Semanal)</CardTitle>
                    <CardDescription>Aprove e confirme os pagamentos semanais dos motoristas.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                      <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Carregando...</p></div>
                    ) : (
                      <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('dataGeracao')}>Gerado em {renderSortIcon('dataGeracao')}</button></TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('motoristaNome')}>Motorista {renderSortIcon('motoristaNome')}</button></TableHead>
                            <TableHead><button className="flex items-center" onClick={() => handleSort('valorTotal')}>Valor Total {renderSortIcon('valorTotal')}</button></TableHead>
                            <TableHead>Chave PIX</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedPagamentos.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{format(item.dataGeracao, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{format(item.periodoInicio, 'dd/MM')} - {format(item.periodoFim, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-medium">{item.motoristaNome}</TableCell>
                                    <TableCell>R$ {item.valorTotal.toFixed(2)}</TableCell>
                                    <TableCell>
                                        {item.motoristaPix &&
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs">{item.motoristaPix}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => localCopyToClipboard(item.motoristaPix)}>
                                                    {copiedPix === item.motoristaPix ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(getDiariaBadgeClass(item.status))}>{item.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {isAdmin && item.status === 'Pendente' && (
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" onClick={() => setDialogAction({type: 'UPDATE_PAGAMENTO_MOTORISTA_STATUS', pagamento: item, status: 'Aprovado'})}><Check className="mr-2 h-4 w-4" /> Aprovar</Button>
                                                </AlertDialogTrigger>
                                            )}
                                            {(isAdmin || isOperator) && item.status === 'Aprovado' && (
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setDialogAction({type: 'UPDATE_PAGAMENTO_MOTORISTA_STATUS', pagamento: item, status: 'Pago'})}><Send className="mr-2 h-4 w-4" /> Pagar</Button>
                                                </AlertDialogTrigger>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function JfabPagamentosPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const { toast } = useToast();

  useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                const q = query(collection(db, 'jfab_usuarios'), where('email', '==', user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0];
                    setUserProfile({ id: userDoc.id, ...userDoc.data() } as Usuario);
                } else { setUserProfile(null); }
            } else { setUserProfile(null); }
        });
        return () => unsubscribeAuth();
  }, []);
  
  const handleConfirmDialog = async () => {
      if (!dialogAction || !currentUser) {
          toast({ title: "Erro", description: "Ação inválida ou usuário não autenticado.", variant: "destructive" });
          return;
      }
      
      const usuarioLogado = userProfile?.nome || currentUser.email || 'Usuário Desconhecido';
      
      try {
        if(dialogAction.type === 'UPDATE_DIARIA_AJUDANTE_STATUS') {
            const { operacao, status } = dialogAction;
            const docRef = doc(db, 'jfab_agendamentos', operacao.id);
            const newHistoryEntry = { campo: 'Status da Diária (Ajudante)', de: operacao.diaria_status, para: status, data: Timestamp.now(), usuario: usuarioLogado };
            await updateDoc(docRef, { diaria_status: status, historico: arrayUnion(newHistoryEntry) });
            toast({ title: "Sucesso!", description: `Pagamento da diária do ajudante foi ${status.toLowerCase()}.` });

        } else if (dialogAction.type === 'DELETE_DIARIA_AJUDANTE') {
            const { operacao } = dialogAction;
            const docRef = doc(db, 'jfab_agendamentos', operacao.id);
            const newHistoryEntry = { campo: 'Diária do Ajudante', de: `Ajudante: ${operacao.ajudante_nome}, Valor: R$ ${operacao.ajudante_diaria_valor}`, para: 'Removido', data: Timestamp.now(), usuario: usuarioLogado };
            await updateDoc(docRef, { ajudante_nome: null, ajudante_diaria_valor: null, ajudante_pix: null, diaria_status: null, historico: arrayUnion(newHistoryEntry) });
            toast({ title: "Sucesso!", description: `Diária do ajudante removida da operação.` });

        } else if (dialogAction.type === 'UPDATE_MANUTENCAO_STATUS') {
            const { veiculo, manutencao, status } = dialogAction;
            const veiculoRef = doc(db, 'jfab_veiculos', veiculo.id);

            const novasManutencoes = (veiculo.manutencoes || []).map(m => 
                m.id === manutencao.id ? { ...m, status_pagamento: status } : m
            );
            await updateDoc(veiculoRef, { manutencoes: novasManutencoes });
             toast({ title: "Sucesso!", description: `Pagamento da manutenção foi ${status.toLowerCase()}.` });
        } else if (dialogAction.type === 'UPDATE_PAGAMENTO_MOTORISTA_STATUS') {
            const { pagamento, status } = dialogAction;
            const docRef = doc(db, 'jfab_pagamentos_motoristas', pagamento.id);
            const updateData: any = { status };
            if (status === 'Aprovado') updateData.dataAprovacao = Timestamp.now();
            if (status === 'Pago') updateData.dataPagamento = Timestamp.now();
            
            await updateDoc(docRef, updateData);
            toast({ title: "Sucesso!", description: `Pagamento do motorista foi ${status.toLowerCase()}.` });
        }
      } catch (e) {
          console.error("Erro ao executar ação:", e);
          toast({ title: "Erro", description: "Não foi possível completar a ação.", variant: "destructive" });
      } finally {
          setDialogAction(null);
      }
  }

  const getDialogContent = () => {
    if (!dialogAction) return { title: '', description: '', confirmClass: ''};
    const { status } = dialogAction as any; // Cast to any to access status if it exists
    const actionText = status === 'Pago' ? 'Pagamento' : 'Aprovação';
    const actionClass = status === 'Pago' ? 'bg-green-600 hover:bg-green-700' : '';

    if (dialogAction.type === 'UPDATE_DIARIA_AJUDANTE_STATUS') {
        const { operacao, status } = dialogAction;
        return {
            title: `Confirmar ${actionText} da Diária do Ajudante`,
            description: `Você tem certeza que deseja marcar a diária de ${operacao.ajudante_nome} como ${status.toLowerCase()}?`,
            confirmClass: actionClass,
        };
    }
    if (dialogAction.type === 'DELETE_DIARIA_AJUDANTE') {
        const { operacao } = dialogAction;
        return {
            title: 'Excluir Diária do Ajudante',
            description: `Essa ação removerá permanentemente a diária do ajudante ${operacao.ajudante_nome} desta operação.`,
            confirmClass: 'bg-destructive hover:bg-destructive/90'
        };
    }
     if (dialogAction.type === 'UPDATE_MANUTENCAO_STATUS') {
        const { veiculo, manutencao, status } = dialogAction;
        return {
            title: `Confirmar ${actionText} da Manutenção`,
            description: `Você tem certeza que deseja marcar o pagamento do serviço "${manutencao.descricao}" no veículo ${veiculo.modelo} como ${status.toLowerCase()}?`,
            confirmClass: actionClass,
        };
    }
    if (dialogAction.type === 'UPDATE_PAGAMENTO_MOTORISTA_STATUS') {
        const { pagamento, status } = dialogAction;
        return {
            title: `Confirmar ${actionText} do Motorista`,
            description: `Você tem certeza que deseja marcar o pagamento de ${pagamento.motoristaNome} como ${status.toLowerCase()}?`,
            confirmClass: actionClass,
        }
    }
    return { title: '', description: '', confirmClass: ''};
  }

  return (
    <>
    <AlertDialog open={!!dialogAction} onOpenChange={(open) => !open && setDialogAction(null)}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Controle de Pagamentos</h2>
        </div>
        
        <Tabs defaultValue="diarias-ajudantes" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="diarias-motoristas">Diárias de Motoristas</TabsTrigger>
                <TabsTrigger value="diarias-ajudantes">Diárias de Ajudantes</TabsTrigger>
                <TabsTrigger value="manutencoes">Manutenções de Veículos</TabsTrigger>
            </TabsList>
            <TabsContent value="diarias-motoristas" className="mt-6">
                <TabDiariasMotoristas userProfile={userProfile} setDialogAction={setDialogAction} />
            </TabsContent>
            <TabsContent value="diarias-ajudantes" className="mt-6">
                <TabDiariasAjudantes userProfile={userProfile} setDialogAction={setDialogAction} />
            </TabsContent>
            <TabsContent value="manutencoes" className="mt-6">
                <TabManutencoes userProfile={userProfile} setDialogAction={setDialogAction} />
            </TabsContent>
        </Tabs>
      </div>
      
       {dialogAction && (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{getDialogContent().title}</AlertDialogTitle>
                <AlertDialogDescription>
                    {getDialogContent().description}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDialogAction(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDialog} className={getDialogContent().confirmClass}>Sim, confirmo</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       )}
    </AlertDialog>
    </>
  );
}
