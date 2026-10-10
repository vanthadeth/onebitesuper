import { type ReactNode } from "react";

export function PageHeading({ title, subtitle, action }: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return <header className="ob-page-heading">
    <div className="ob-page-heading-copy"><h1>{title}</h1><p>{subtitle}</p></div>
    {action && <div className="ob-page-heading-action">{action}</div>}
  </header>;
}
