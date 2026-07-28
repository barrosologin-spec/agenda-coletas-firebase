// src/types/jfab_types.ts

// Define um item individual dentro de um agendamento
export interface ItemColeta {
  id?: string; // ID para o React key
  descricao: string;
  quantidade: number;
  pallets?: number;
  peso?: number; // em kg
}

export interface HistoricoItem {
    campo: string; // Ex: 'status', 'cliente', 'item.quantidade'
    de: any;
    para: any;
    data: Date;
    usuario: string; 
}

export interface Endereco {
  nome: string;
  endereco: string;
}

// Define o tipo para um agendamento de coleta.
export interface Agendamento {
  id: string;
  cliente: string; // Cliente contratante do serviço
  origem: Endereco;
  destino?: Endereco; // Opcional, usado apenas em 'Coleta'
  data: Date;
  motorista: string;
  motoristaId?: string;
  status: 'Pendente' | 'Em Rota' | 'Concluído' | 'Cancelado';
  observacoes?: string;
  tipo: 'Envio' | 'Recebimento' | 'Coleta';
  notaFiscal?: string;
  itens: ItemColeta[];
  historico?: HistoricoItem[];
  // Campos para cálculo de tempo
  rota_iniciada_em?: Date;
  rota_finalizada_em?: Date;
  duracao_rota_minutos?: number;
  // Campos para anexo
  anexoUrl?: string;
  anexoNome?: string;
  // Campos da transportadora
  transportadora?: string;
  veiculo?: string;
  placa?: string;
  // Campos do Ajudante e Diária
  ajudante_nome?: string | null;
  ajudante_diaria_valor?: number | null;
  ajudante_pix?: string | null;
  diaria_status?: 'Pendente' | 'Aprovado' | 'Pago' | null;
}

// Define o tipo para um usuário do sistema.
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  nivel: 'Administrador' | 'Operador' | 'Motorista' | 'Cliente' | 'Pendente';
  telefone?: string;
  pix?: string;
}

// Define o tipo para uma rota de coleta.
export interface Rota {
    id: string;
    motoristaId: string;
    data: Date;
    coletasIds: string[]; // Array de IDs de agendamentos
    status: 'Planejada' | 'Em Andamento' | 'Concluída';
}

// Define o tipo para uma notificação do sistema
export interface Notificacao {
    id: string;
    title: string;
    desc: string;
    time: Date;
    read: boolean;
    arquivada?: boolean; // Se o usuário não-admin "escondeu" a notificação
    paraUsuarioId?: string; // ID do usuário específico para a notificação
}

// Define o tipo para uma manutenção de veículo
export interface Manutencao {
  id: string;
  dataEntrada: Date;
  dataSaidaPrevista?: Date;
  dataSaidaReal?: Date;
  descricao: string;
  custo?: number;
  oficina?: string;
  oficina_pix?: string;
  concluida: boolean;
  status_pagamento?: 'Pendente' | 'Aprovado' | 'Pago';
}

// Define o tipo para um veículo da frota
export interface Veiculo {
  id: string;
  modelo: string;
  marca: string;
  ano: number;
  placa: string;
  renavam: string;
  tipo: 'Caminhão' | 'Carro' | 'Moto' | 'Van' | 'Outro';
  status: 'Disponível' | 'Em Rota' | 'Em Manutenção';
  manutencoes?: Manutencao[];
}

// Define o tipo para as configurações de diárias dos motoristas
export interface ConfiguracaoDiaria {
    id: 'diarias_motoristas';
    valores: {
        motoristaId: string;
        valor: number;
    }[];
}

// Define o tipo para um pagamento de motorista gerado
export interface PagamentoMotorista {
  id: string;
  motoristaId: string;
  motoristaNome: string;
  motoristaPix?: string;
  periodoInicio: Date;
  periodoFim: Date;
  diasTrabalhados: number;
  valorDiaria: number;
  valorTotal: number;
  status: 'Pendente' | 'Aprovado' | 'Pago';
  dataGeracao: Date;
  dataAprovacao?: Date;
  dataPagamento?: Date;
}
