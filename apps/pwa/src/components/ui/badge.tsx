import { cn } from "@/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-slate-600 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
        ok: "border-lime-600 bg-lime-100 text-lime-900",
        warn: "border-amber-600 bg-amber-100 text-amber-900",
        crit: "border-red-700 bg-red-100 text-red-900",
        outline: "border-slate-400 text-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
