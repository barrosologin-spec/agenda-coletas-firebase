// src/components/jfab_detalhes_operacao.tsx
"use client"

import type { Agendamento, HistoricoItem } from "@/types/jfab_types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { format, formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Download, History, User, UserPlus } from "lucide-react";


interface JfabDetalhesOperacaoProps {
    isOpen: boolean;
    onClose: () => void;
    agendamento: Agendamento | null;
}

const renderizaValorHistorico = (item: HistoricoItem) => {
    if (item.de === null && item.para === 'Criado') {
        return <p>Operação criada por <span className="font-semibold">{item.usuario}</span>.</p>;
    }
    
    return (
        <p>
            <span className="font-semibold">{item.usuario}</span> alterou{' '}
            <span className="font-semibold text-primary">{item.campo}</span> de{' '}
            <span className="italic bg-red-500/10 px-1 rounded">{String(item.de || 'Vazio')}</span> para{' '}
            <span className="italic bg-green-500/10 px-1 rounded">{String(item.para || 'Vazio')}</span>.
        </p>
    );
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

export function JfabDetalhesOperacao({ isOpen, onClose, agendamento }: JfabDetalhesOperacaoProps) {

    if (!agendamento) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg w-full flex flex-col">
                <SheetHeader className="mb-6">
                    <SheetTitle>Detalhes da Operação</SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                        ID: <span className="font-mono text-xs bg-muted p-1 rounded">{agendamento.id.substring(0,7).toUpperCase()}</span>
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                            <Badge variant={'outline'} className={cn("whitespace-nowrap", getBadgeClass(agendamento.status))}>
                            {agendamento.status}
                        </Badge>
                    </div>
                        <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo</span>
                        <span className="font-medium">{agendamento.tipo}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente Contratante</span>
                        <span className="font-medium">{agendamento.cliente}</span>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-medium mb-2 text-muted-foreground">Origem</h4>
                        <div className="p-3 border rounded-md bg-muted/50 space-y-1">
                            <p className="font-medium">{agendamento.origem?.nome}</p>
                            <p className="text-muted-foreground text-xs">{agendamento.origem?.endereco}</p>
                        </div>
                    </div>

                    {agendamento.destino && (
                        <div>
                            <h4 className="font-medium mb-2 text-muted-foreground">Destino</h4>
                            <div className="p-3 border rounded-md bg-muted/50 space-y-1">
                                <p className="font-medium">{agendamento.destino?.nome}</p>
                                <p className="text-muted-foreground text-xs">{agendamento.destino?.endereco}</p>
                            </div>
                        </div>
                    )}
                    <Separator />
                        <div className="flex justify-between">
                        <span className="text-muted-foreground">Data e Hora</span>
                        <span className="font-medium">{agendamento.data ? format(agendamento.data, "dd/MM/yyyy 'às' HH:mm") : 'N/A'}</span>
                    </div>
                        {agendamento.status === 'Concluído' && agendamento.duracao_rota_minutos != null && (
                            <div className="flex justify-between">
                            <span className="text-muted-foreground">Duração da Rota</span>
                            <span className="font-medium flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> {agendamento.duracao_rota_minutos} min</span>
                        </div>
                        )}
                        <div className="flex justify-between">
                        <span className="text-muted-foreground">Motorista</span>
                        <span className="font-medium">{agendamento.motorista}</span>
                    </div>
                        <div className="flex justify-between">
                        <span className="text-muted-foreground">Nota Fiscal</span>
                        <span className="font-medium font-mono text-xs">{agendamento.notaFiscal || 'N/A'}</span>
                    </div>
                    {(agendamento.transportadora || agendamento.veiculo || agendamento.placa) && <Separator />}
                        {agendamento.transportadora && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Transportadora</span>
                            <span className="font-medium">{agendamento.transportadora}</span>
                        </div>
                        )}
                        {agendamento.veiculo && (
                            <div className="flex justify-between">
                            <span className="text-muted-foreground">Veículo</span>
                            <span className="font-medium">{agendamento.veiculo}</span>
                        </div>
                        )}
                        {agendamento.placa && (
                            <div className="flex justify-between">
                            <span className="text-muted-foreground">Placa</span>
                            <span className="font-medium font-mono">{agendamento.placa}</span>
                        </div>
                        )}

                    {agendamento.ajudante_nome && <Separator />}
                    {agendamento.ajudante_nome && (
                            <div>
                            <h4 className="font-medium mb-3 text-muted-foreground flex items-center gap-2"><UserPlus className="w-4 h-4"/> Informações do Ajudante</h4>
                            <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                                    <div className="flex justify-between">
                                    <span className="text-muted-foreground">Nome</span>
                                    <span className="font-medium">{agendamento.ajudante_nome}</span>
                                </div>
                                    <div className="flex justify-between">
                                    <span className="text-muted-foreground">Valor da Diária</span>
                                    <span className="font-medium">R$ {agendamento.ajudante_diaria_valor?.toFixed(2)}</span>
                                </div>
                                    <div className="flex justify-between">
                                    <span className="text-muted-foreground">Chave PIX</span>
                                    <span className="font-medium font-mono text-xs">{agendamento.ajudante_pix}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Status Pagamento</span>
                                    <Badge variant={'outline'} className={cn("whitespace-nowrap", getDiariaBadgeClass(agendamento.diaria_status))}>
                                        {agendamento.diaria_status || 'N/A'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        )}

                    <Separator />
                    <div>
                        <h4 className="font-medium mb-2 text-muted-foreground">Itens</h4>
                        <div className="space-y-2 rounded-md border p-2 bg-muted/50">
                            {agendamento.itens.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-2 rounded">
                                    <div>
                                        <p>{item.descricao} <span className="font-bold ml-2">{item.quantidade}x</span></p>
                                        <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                                            <span>{item.pallets || 0} pallets</span>
                                            <span>{item.peso || 0} kg</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                        {agendamento.anexoUrl && (
                            <>
                            <Separator />
                            <div>
                                <h4 className="font-medium mb-2 text-muted-foreground">Anexo</h4>
                                <Button asChild variant="outline" className="w-full justify-start">
                                    <a href={agendamento.anexoUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4" />
                                        {agendamento.anexoNome || 'Baixar Anexo'}
                                    </a>
                                </Button>
                            </div>
                        </>
                        )}
                        {agendamento.observacoes && (
                            <>
                            <Separator />
                            <div>
                                <h4 className="font-medium mb-2 text-muted-foreground">Observações</h4>
                                <p className="p-2 border rounded-md bg-muted/50">{agendamento.observacoes}</p>
                            </div>
                        </>
                        )}
                        {agendamento.historico && agendamento.historico.length > 0 && (
                        <div>
                            <h4 className="font-medium mb-3 text-muted-foreground flex items-center gap-2"><History className="w-4 h-4"/> Histórico de Alterações</h4>
                            <div className="space-y-3">
                                {agendamento.historico.map((hist, index) => (
                                    <div key={index} className="flex items-start gap-3 text-xs">
                                        <div className="flex-shrink-0 pt-1">
                                                <User className="w-3 h-3"/>
                                        </div>
                                        <div className="flex-grow">
                                            {renderizaValorHistorico(hist)}
                                            <p className="text-muted-foreground/80">
                                                ({hist.data ? formatDistance(hist.data, new Date(), {addSuffix: true, locale: ptBR}) : 'N/A'})
                                            </p>
                                        </div>
                                        <span className="text-muted-foreground/80 flex-shrink-0">{hist.data ? format(hist.data, "dd/MM/yy HH:mm") : 'N/A'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}
                </div>
                </ScrollArea>
                    <SheetClose className="mt-6 w-full" asChild>
                    <Button type="button" variant="outline">Fechar</Button>
                    </SheetClose>
            </SheetContent>
        </Sheet>
    )
}
