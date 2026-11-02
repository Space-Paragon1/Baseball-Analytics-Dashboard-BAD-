import { ReactNode } from "react";

interface ExportButtonProps {
  label: string;
  href: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
}

/** A download link styled as a button (exports are public GET endpoints). */
export default function ExportButton({ label, href, icon, variant = "secondary" }: ExportButtonProps) {
  return (
    <a href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"} download>
      {icon}
      {label}
    </a>
  );
}
