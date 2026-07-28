// Página para administradores gerenciarem os usuários do sistema.
"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Usuario } from '@/types/jfab_types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PlusCircle, MoreHorizontal, Loader2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { JfabFormularioUsuario } from '@/components/jfab_formulario_usuario';
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


export default function JfabUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const { toast } = useToast();

  const handleNewUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };
  
  const handleEditUser = (user: Usuario) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
        const docRef = doc(db, 'jfab_usuarios', userToDelete.id);
        await deleteDoc(docRef);
        toast({ title: "Sucesso!", description: "Usuário excluído." });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        toast({ title: "Erro", description: "Não foi possível excluir o usuário.", variant: "destructive" });
    } finally {
        setUserToDelete(null);
    }
  }


  useEffect(() => {
    const q = query(collection(db, 'jfab_usuarios'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data: Usuario[] = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as Usuario);
        });
        setUsuarios(data);
        setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar usuários:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredUsuarios = usuarios.filter(
    (user) =>
        user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className='flex-1'>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>Adicione, edite e defina permissões de usuários.</CardDescription>
              </div>
              <Button onClick={handleNewUser} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
              <Input 
                placeholder="Buscar por nome ou e-mail..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Carregando usuários...</p>
            </div>
          ) : (
            <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsuarios.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.nivel}</Badge>
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
                          <DropdownMenuItem onClick={() => handleEditUser(item)}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive flex items-center gap-2" onSelect={() => setUserToDelete(item)}>
                              <Trash2 className="h-4 w-4" /> Excluir
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
          )}
        </CardContent>
      </Card>
      
       {userToDelete && (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                    Essa ação não pode ser desfeita. Isso excluirá permanentemente o usuário <span className="font-bold">{userToDelete.nome}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                onClick={confirmDeleteUser}
                className="bg-destructive hover:bg-destructive/90"
                >
                    Sim, excluir
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       )}
      </AlertDialog>
      
      <JfabFormularioUsuario 
        isOpen={isFormOpen}
        onClose={handleFormClose}
        usuario={selectedUser}
      />
    </>
  );
}
