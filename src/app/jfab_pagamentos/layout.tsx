import { JfabLayoutPrincipal } from '@/components/jfab_layout_principal';

// Este arquivo de layout aplica o layout principal à rota de pagamentos.
export default function JfabPagamentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JfabLayoutPrincipal>{children}</JfabLayoutPrincipal>;
}
