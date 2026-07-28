// Esta página permitirá o gerenciamento de agendamentos.
// Incluirá uma tabela de coletas e um botão para criar novas.
"use client"

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, writeBatch, orderBy, Timestamp, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash2, ArrowDownLeft, ArrowUpRight, ChevronsUpDown, ArrowUp, ArrowDown, Eye, Pencil, Clock, Home, ArrowRight, FilterX, Box, User } from 'lucide-react';
import { JfabFormularioAgendamento } from '@/components/jfab_formulario_agendamento';
import type { Agendamento, Usuario } from '@/types/jfab_types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { User as FirebaseUser } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams, useRouter } from 'next/navigation';
import { JfabDetalhesOperacao } from '@/components/jfab_detalhes_operacao';


type SortKey = keyof Agendamento | 'data';

const getCriador = (historico?: Agendamento['historico']) => {
    if (!historico || historico.length === 0) return 'N/A';
    // O histórico já vem ordenado do mais recente para o mais antigo,
    // então a criação é o último item.
    const criacao = historico[historico.length - 1];
    if (criacao && criacao.para === 'Criado') {
        return criacao.usuario.split('@')[0]; // Mostra apenas o nome antes do @
    }
    // Fallback caso não encontre o evento de criação
    return historico[0]?.usuario.split('@')[0] || 'N/A';
};

const getBadgeClass = (status: string) => {
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

// Componente de Card para visualização em telas pequenas
const OperacaoCard = ({ 
    item, 
    onViewDetails, 
    onEdit, 
    onDelete, 
    isAdmin 
} : { 
    item: Agendamento, 
    onViewDetails: (item: Agendamento) => void, 
    onEdit: (item: Agendamento) => void,
    onDelete: (id: string) => void,
    isAdmin: boolean,
}) => {
  return (
    <Card onClick={() => onViewDetails(item)}>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-base">{item.cliente}</CardTitle>
                 <CardDescription className="font-mono text-xs">ID: {item.id.substring(0, 7).toUpperCase()}</CardDescription>
            </div>
            <Badge variant={'outline'} className={cn("whitespace-nowrap", getBadgeClass(item.status))}>
                {item.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
            {item.tipo === 'Recebimento' ? <ArrowDownLeft className="h-4 w-4 text-blue-500" /> : 
             (item.tipo === 'Envio' ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : 
             <Box className="h-4 w-4 text-purple-500" />)}
            <span>{item.tipo}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4"/>
            <span>{item.data ? format(item.data, "dd/MM/yyyy 'às' HH:mm") : 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4"/>
            <span>Motorista: <span className="font-medium text-foreground">{item.motorista}</span></span>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
            <Home className="h-4 w-4 mt-0.5 flex-shrink-0"/>
            <div className="flex flex-col">
                <span>{item.origem?.nome || 'N/A'}</span>
                {item.destino && <ArrowRight className="h-3 w-3 my-1 text-muted-foreground"/>}
                {item.destino && <span>{item.destino.nome}</span>}
            </div>
        </div>
         <div className="text-xs text-muted-foreground">
            Criado por: {getCriador(item.historico)}
         </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
              <Pencil className="mr-2 h-4 w-4"/> Editar
          </Button>
          {isAdmin && (
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
                   <Trash2 className="mr-2 h-4 w-4"/> Excluir
                </Button>
            </AlertDialogTrigger>
          )}
      </CardFooter>
    </Card>
  )
};


function AgendamentosContent() {
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<string | null>(null);
    const { toast } = useToast();
    const [sortKey, setSortKey] = useState<SortKey>('data');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<Usuario | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState('');
    const [tipoFilter, setTipoFilter] = useState('');
    const [motoristaFilter, setMotoristaFilter] = useState('');
    const [motoristas, setMotoristas] = useState<Usuario[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();


    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                const q = query(collection(db, 'jfab_usuarios'), where('email', '==', user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0];
                    setUserProfile({ id: userDoc.id, ...userDoc.data() } as Usuario);
                } else {
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
        });

        const qAgendamentos = query(collection(db, 'jfab_agendamentos'), orderBy('data', 'desc'));
        const unsubscribeAgendamentos = onSnapshot(qAgendamentos, (querySnapshot) => {
            const data: Agendamento[] = [];
            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                 const historico = docData.historico?.map((h: any) => ({
                    ...h,
                    data: h.data.toDate(),
                })) || [];

                data.push({ 
                    id: doc.id,
                    ...docData,
                    data: docData.data?.toDate(),
                    historico: historico.sort((a,b) => b.data.getTime() - a.data.getTime()),
                    rota_iniciada_em: docData.rota_iniciada_em?.toDate(),
                    rota_finalizada_em: docData.rota_finalizada_em?.toDate(),
                } as Agendamento);
            });
            setAgendamentos(data);
            setLoading(false);

            const agendamentoId = searchParams.get('id');
            const agendamentoParaEditarId = searchParams.get('editar');

            if (agendamentoId) {
                const agendamentoParaVer = data.find(a => a.id === agendamentoId);
                if (agendamentoParaVer) handleViewDetails(agendamentoParaVer);
                // Limpa o param da URL para evitar reabertura no refresh
                // router.replace('/jfab_agendamentos', { scroll: false }); 
            }
            if (agendamentoParaEditarId) {
                const agendamentoParaEditar = data.find(a => a.id === agendamentoParaEditarId);
                if (agendamentoParaEditar) handleEditAgendamento(agendamentoParaEditar);
                // router.replace('/jfab_agendamentos', { scroll: false });
            }

        }, (error) => {
            console.error("Erro ao buscar agendamentos:", error);
            setLoading(false);
        });
        
        const qMotoristas = query(collection(db, 'jfab_usuarios'), where('nivel', '==', 'Motorista'));
        const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
            const data: Usuario[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
            setMotoristas(data);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeAgendamentos();
            unsubscribeMotoristas();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleNewAgendamento = () => {
        setSelectedAgendamento(null);
        setIsFormOpen(true);
    };

    const handleEditAgendamento = (agendamento: Agendamento) => {
        setSelectedAgendamento(agendamento);
        setIsFormOpen(true);
    };

    const handleViewDetails = (agendamento: Agendamento) => {
        setSelectedAgendamento(agendamento);
        setIsDetailsOpen(true);
    }

    const confirmDeleteAgendamento = async () => {
        if (!agendamentoToDelete) return;
        const batch = writeBatch(db);
        const docRef = doc(db, 'jfab_agendamentos', agendamentoToDelete);
        batch.delete(docRef);
        try {
            await batch.commit();
            toast({ title: "Sucesso!", description: "Agendamento excluído." });
        } catch (error) {
            console.error("Erro ao excluir agendamento:", error);
            toast({ title: "Erro", description: "Não foi possível excluir o agendamento.", variant: "destructive" });
        }
        setAgendamentoToDelete(null);
    };
    
    const handleFormClose = () => {
        setIsFormOpen(false);
        setSelectedAgendamento(null);
    };
    
    const handleResetFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setTipoFilter('');
        setMotoristaFilter('');
        setCurrentPage(1);
    }

    const filteredAgendamentos = agendamentos.filter((item) => {
      const searchTermLower = searchTerm.toLowerCase();
      const searchMatch = (
        item.cliente.toLowerCase().includes(searchTermLower) ||
        item.id.toLowerCase().includes(searchTermLower) ||
        item.notaFiscal?.toLowerCase().includes(searchTermLower) ||
        item.origem?.nome.toLowerCase().includes(searchTermLower) ||
        item.destino?.nome.toLowerCase().includes(searchTermLower)
      );
      const statusMatch = statusFilter ? item.status === statusFilter : true;
      const tipoMatch = tipoFilter ? item.tipo === tipoFilter : true;
      const motoristaMatch = motoristaFilter ? item.motorista === motoristaFilter : true;

      return searchMatch && statusMatch && tipoMatch && motoristaMatch;
    });

    const sortedAgendamentos = [...filteredAgendamentos].sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (aValue === undefined || bValue === undefined) return 0;
        
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

    // Lógica de paginação
    const totalPages = Math.ceil(sortedAgendamentos.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedAgendamentos.slice(indexOfFirstItem, indexOfLastItem);
    
    const paginate = (pageNumber: number) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
  return (
    <>
        <AlertDialog>
          <TooltipProvider>
            <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className='flex-1'>
                        <CardTitle>Gerenciamento de Operações</CardTitle>
                        <CardDescription>Visualize, crie e gerencie as operações de envio e recebimento.</CardDescription>
                    </div>
                    <Button onClick={handleNewAgendamento} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Operação
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 mb-4">
                    <Input 
                        placeholder="Buscar por cliente, ID, nota fiscal, origem ou destino..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value === 'todos-status' ? '' : value); setCurrentPage(1);}}>
                            <SelectTrigger><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos-status">Todos os Status</SelectItem>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                                <SelectItem value="Em Rota">Em Rota</SelectItem>
                                <SelectItem value="Concluído">Concluído</SelectItem>
                                <SelectItem value="Cancelado">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={tipoFilter} onValueChange={(value) => { setTipoFilter(value === 'todos-tipos' ? '' : value); setCurrentPage(1);}}>
                            <SelectTrigger><SelectValue placeholder="Filtrar por Tipo" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos-tipos">Todos os Tipos</SelectItem>
                                <SelectItem value="Recebimento">Recebimento</SelectItem>
                                <SelectItem value="Envio">Envio</SelectItem>
                                <SelectItem value="Coleta">Coleta</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={motoristaFilter} onValueChange={(value) => { setMotoristaFilter(value === 'todos-motoristas' ? '' : value); setCurrentPage(1);}}>
                            <SelectTrigger><SelectValue placeholder="Filtrar por Motorista" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos-motoristas">Todos os Motoristas</SelectItem>
                                {motoristas.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleResetFilters} className="flex items-center gap-2">
                            <FilterX className="h-4 w-4" />
                            Limpar Filtros
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-4 text-muted-foreground">Carregando operações...</p>
                    </div>
                ) : currentItems.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">Nenhuma operação encontrada.</p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm || statusFilter || tipoFilter || motoristaFilter ? "Tente um filtro diferente." : "Clique em 'Nova Operação' para começar."}
                        </p>
                    </div>
                ) : (
                <>
                {/* Visualização em Tabela para telas grandes */}
                <div className="border rounded-md hidden md:block">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>
                         <button className="flex items-center" onClick={() => handleSort('id')}>ID {renderSortIcon('id')}</button>
                    </TableHead>
                    <TableHead>
                        <button className="flex items-center" onClick={() => handleSort('tipo')}>Tipo {renderSortIcon('tipo')}</button>
                    </TableHead>
                    <TableHead>
                        <button className="flex items-center" onClick={() => handleSort('cliente')}>Cliente {renderSortIcon('cliente')}</button>
                    </TableHead>
                    <TableHead>Origem/Destino</TableHead>
                    <TableHead>
                         <button className="flex items-center" onClick={() => handleSort('data')}>Data/Hora {renderSortIcon('data')}</button>
                    </TableHead>
                    <TableHead>
                        <button className="flex items-center" onClick={() => handleSort('motorista')}>Motorista {renderSortIcon('motorista')}</button>
                    </TableHead>
                    <TableHead>
                        <button className="flex items-center" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</button>
                    </TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentItems.map((item) => (
                    <TableRow key={item.id} onClick={() => handleViewDetails(item)} className="cursor-pointer">
                        <TableCell className="font-mono text-xs">{item.id.substring(0, 7).toUpperCase()}</TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            {item.tipo === 'Recebimento' ? 
                              <ArrowDownLeft className="h-4 w-4 text-blue-500" /> : 
                              (item.tipo === 'Envio' ? 
                                <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : 
                                <Box className="h-4 w-4 text-purple-500" />)
                            }
                            {item.tipo}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.cliente}</TableCell>
                        <TableCell className="text-xs">
                           <div className='flex items-center gap-2'>
                                <Home className="h-3 w-3 text-muted-foreground"/>
                                <span>{item.origem?.nome || 'N/A'}</span>
                                {item.destino && <ArrowRight className="h-3 w-3 text-muted-foreground"/>}
                                {item.destino && <span>{item.destino.nome}</span>}
                           </div>
                        </TableCell>
                        <TableCell>{item.data ? format(item.data, "dd/MM/yyyy HH:mm") : 'N/A'}</TableCell>
                        <TableCell>{item.motorista}</TableCell>
                        <TableCell>
                        <Badge 
                            variant={'outline'}
                            className={cn("whitespace-nowrap", getBadgeClass(item.status))}
                        >
                            {item.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getCriador(item.historico)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className='flex items-center justify-end gap-2'>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <Button variant="ghost" size="icon" onClick={() => handleViewDetails(item)}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">Ver Detalhes</span>
                                 </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Ver Detalhes</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleEditAgendamento(item)}>
                                      <Pencil className="h-4 w-4" />
                                      <span className="sr-only">Editar</span>
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar</p>
                              </TooltipContent>
                            </Tooltip>
                            {userProfile?.nivel === 'Administrador' && (
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setAgendamentoToDelete(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Excluir</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Excluir</p>
                                </TooltipContent>
                                </Tooltip>
                            )}
                           </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                </div>
                
                {/* Visualização em Card para telas pequenas */}
                <div className="grid gap-4 md:hidden">
                     {currentItems.map((item) => (
                        <OperacaoCard 
                           key={item.id}
                           item={item}
                           onViewDetails={handleViewDetails}
                           onEdit={handleEditAgendamento}
                           onDelete={setAgendamentoToDelete}
                           isAdmin={userProfile?.nivel === 'Administrador'}
                        />
                     ))}
                </div>
                </>
                )}
            </CardContent>
            {totalPages > 1 && (
                <CardFooter>
                    <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                        <div>
                            Página {currentPage} de {totalPages}
                        </div>
                         <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => paginate(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => paginate(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                Próximo
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            )}
            </Card>
          </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso excluirá permanentemente a operação.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setAgendamentoToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={confirmDeleteAgendamento}
                    className="bg-destructive hover:bg-destructive/90"
                    >
                        Sim, excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <JfabFormularioAgendamento 
            isOpen={isFormOpen}
            onClose={handleFormClose}
            agendamento={selectedAgendamento}
        />
        
        <JfabDetalhesOperacao 
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            agendamento={selectedAgendamento}
        />
    </>
  );
}

export default function JfabAgendamentosPage() {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AgendamentosContent />
        </React.Suspense>
    )
}
