import { JfabLayoutPrincipal } from '@/components/jfab_layout_principal';

// Este arquivo de layout aplica o layout principal à rota de agendamentos.
export default function JfabAgendamentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JfabLayoutPrincipal>{children}</JfabLayoutPrincipal>;
}
