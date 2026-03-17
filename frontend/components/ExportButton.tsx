import { ReactNode } from "react";

interface ExportButtonProps {
  label: string;
  href: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
}

export default function ExportButton({
  label,
  href,
  icon,
  variant = "secondary",
}: ExportButtonProps) {
  const handleClick = () => {
    window.open(href, "_blank");
  };

  const cls =
    variant === "primary"
      ? "btn-primary"
      : "btn-secondary";

  return (
    <button onClick={handleClick} className={cls} type="button">
      {icon && <span className="w-4 h-4">{icon}</span>}
      {label}
    </button>
  );
}
