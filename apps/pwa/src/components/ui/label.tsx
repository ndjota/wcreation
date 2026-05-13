import { cn } from "@/lib/cn";
import * as React from "react";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-xs font-medium text-slate-700 dark:text-slate-300", className)} {...props} />
));
Label.displayName = "Label";

export { Label };
