// Página para administradores e operadores gerenciarem a frota de veículos.
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Veiculo, Manutencao } from '@/types/jfab_types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { PlusCircle, Loader2, Trash2, Pencil, Car, Wrench, MoreHorizontal } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { JfabFormularioVeiculo } from '@/components/jfab_formulario_veiculo';
import { JfabManutencaoVeiculo } from '@/components/jfab_manutencao_veiculo';

const getStatusBadgeClass = (status: string) => {
    switch (status) {
        case 'Disponível':
            return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
        case 'Em Rota':
            return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30';
        case 'Em Manutenção':
             return 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30';
        default:
            return '';
    }
};

const VeiculoCard = ({ 
    item, 
    onEdit, 
    onDelete, 
    onMaintenance 
}: { 
    item: Veiculo, 
    onEdit: (item: Veiculo) => void,
    onDelete: (id: string) => void,
    onMaintenance: (item: Veiculo) => void,
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-base">{item.marca} {item.modelo}</CardTitle>
                 <CardDescription className="font-mono text-xs">Placa: {item.placa}</CardDescription>
            </div>
            <Badge variant={'outline'} className={cn("whitespace-nowrap", getStatusBadgeClass(item.status))}>
                {item.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p><strong>Tipo:</strong> {item.tipo}</p>
        <p><strong>Ano:</strong> {item.ano}</p>
        <p><strong>Renavam:</strong> {item.renavam}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
           <Button variant="outline" size="sm" onClick={() => onMaintenance(item)}>
              <Wrench className="mr-2 h-4 w-4"/> Manutenções
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
              <Pencil className="mr-2 h-4 w-4"/> Editar
          </Button>
          <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
                 <Trash2 className="mr-2 h-4 w-4"/> Excluir
              </Button>
          </AlertDialogTrigger>
      </CardFooter>
    </Card>
  )
};


export default function JfabVeiculosPage() {
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
    const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
    const [veiculoToDelete, setVeiculoToDelete] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const q = query(collection(db, 'jfab_veiculos'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Veiculo[] = snapshot.docs.map(doc => ({
                 id: doc.id,
                 ...doc.data(),
                 manutencoes: (doc.data().manutencoes || []).map((m: any) => ({
                    ...m,
                    dataEntrada: m.dataEntrada.toDate(),
                    dataSaidaPrevista: m.dataSaidaPrevista?.toDate(),
                    dataSaidaReal: m.dataSaidaReal?.toDate(),
                 }))
            } as Veiculo));
            setVeiculos(data);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar veículos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleNewVeiculo = () => {
        setSelectedVeiculo(null);
        setIsFormOpen(true);
    };

    const handleEditVeiculo = (veiculo: Veiculo) => {
        setSelectedVeiculo(veiculo);
        setIsFormOpen(true);
    };

    const handleMaintenance = (veiculo: Veiculo) => {
        setSelectedVeiculo(veiculo);
        setIsMaintenanceOpen(true);
    };
    
    const handleFormClose = () => {
        setIsFormOpen(false);
        setSelectedVeiculo(null);
    };

    const handleMaintenanceClose = () => {
        setIsMaintenanceOpen(false);
        setSelectedVeiculo(null);
    }
    
    const confirmDeleteVeiculo = async () => {
        if (!veiculoToDelete) return;

        try {
            await deleteDoc(doc(db, 'jfab_veiculos', veiculoToDelete));
            toast({ title: "Sucesso!", description: "Veículo excluído." });
        } catch (error) {
            console.error("Erro ao excluir veículo:", error);
            toast({ title: "Erro", description: "Não foi possível excluir o veículo.", variant: "destructive" });
        }
        setVeiculoToDelete(null);
    };
    
    const filteredVeiculos = useMemo(() => {
      return veiculos.filter((item) => {
          const searchTermLower = searchTerm.toLowerCase();
          return (
            item.modelo.toLowerCase().includes(searchTermLower) ||
            item.marca.toLowerCase().includes(searchTermLower) ||
            item.placa.toLowerCase().includes(searchTermLower) ||
            item.renavam.toLowerCase().includes(searchTermLower)
          );
      });
    }, [veiculos, searchTerm]);

  return (
    <>
      <AlertDialog>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className='flex-1'>
                <CardTitle>Gerenciamento de Frota</CardTitle>
                <CardDescription>Cadastre, edite e controle os veículos e suas manutenções.</CardDescription>
              </div>
              <Button onClick={handleNewVeiculo} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Veículo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Buscar por modelo, marca, placa ou renavam..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Carregando veículos...</p>
              </div>
            ) : filteredVeiculos.length === 0 ? (
                 <div className="text-center py-10">
                    <Car className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Nenhum veículo encontrado.</p>
                    <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Tente uma busca diferente." : "Clique em 'Novo Veículo' para cadastrar."}
                    </p>
                </div>
            ) : (
                <>
                {/* Tabela para telas grandes */}
                <div className="border rounded-md hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVeiculos.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.marca} {item.modelo}</TableCell>
                          <TableCell className="font-mono">{item.placa}</TableCell>
                          <TableCell>{item.tipo}</TableCell>
                          <TableCell>{item.ano}</TableCell>
                          <TableCell>
                            <Badge variant={'outline'} className={getStatusBadgeClass(item.status)}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditVeiculo(item)}>
                                    <Pencil className="mr-2 h-4 w-4"/> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMaintenance(item)}>
                                    <Wrench className="mr-2 h-4 w-4"/> Manutenções
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive flex items-center" onSelect={(e) => { e.preventDefault(); setVeiculoToDelete(item.id); }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Cards para telas pequenas */}
                <div className="grid gap-4 md:hidden">
                    {filteredVeiculos.map((item) => (
                        <VeiculoCard 
                            key={item.id}
                            item={item}
                            onEdit={handleEditVeiculo}
                            onDelete={setVeiculoToDelete}
                            onMaintenance={handleMaintenance}
                        />
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o veículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVeiculoToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVeiculo}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <JfabFormularioVeiculo
        isOpen={isFormOpen}
        onClose={handleFormClose}
        veiculo={selectedVeiculo}
      />
      <JfabManutencaoVeiculo
        isOpen={isMaintenanceOpen}
        onClose={handleMaintenanceClose}
        veiculo={selectedVeiculo}
      />
    </>
  );
}
