import { Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Componente para o logo da aplicação.
// Utiliza o ícone de caminhão para remeter à logística.
export function JfabLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-primary", className)}>
      <Truck className="h-7 w-7" />
      <h1 className={cn("text-xl font-bold whitespace-nowrap")}>JFAB TRANSPORTES</h1>
    </div>
  );
}
