import type { ReactNode } from "react";
import { ArrowRight, Plus, ShoppingBag } from "lucide-react";

type EmptyAction = { label: string; onClick: () => void; icon?: ReactNode; disabled?: boolean };

/** Callers supply creation actions only when the current user is authorized. */
export function EmptyState({ title, body, icon = <ShoppingBag size={30} />, action, secondaryAction, className = "" }: {
  title: string; body: string; icon?: ReactNode; action?: EmptyAction; secondaryAction?: EmptyAction; className?: string;
}) {
  return <div className={`ob-empty-state ${className}`}>
    <div className="ob-empty-art" aria-hidden="true"><span className="ob-empty-orbit"/><span className="ob-empty-symbol">{icon}</span>{action && <span className="ob-empty-spark"><Plus size={14}/></span>}</div>
    <h3>{title}</h3><p>{body}</p>
    {(action || secondaryAction) && <div className="ob-empty-actions">
      {action && <button type="button" className="d-btn d-btn-primary ob-empty-primary" disabled={action.disabled} onClick={action.onClick}>{action.icon ?? <Plus size={18}/>}<span>{action.label}</span><ArrowRight size={17}/></button>}
      {secondaryAction && <button type="button" className="d-btn d-btn-outline ob-empty-secondary" disabled={secondaryAction.disabled} onClick={secondaryAction.onClick}>{secondaryAction.icon}<span>{secondaryAction.label}</span></button>}
    </div>}
  </div>;
}
