import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/hooks/useI18n";
import { Globe } from "lucide-react";

const langs = [
  { code: "es-AR", label: "Español (AR)" },
  { code: "en", label: "English" },
] as const;

export function LangSwitcher() {
  const { i18n, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("common:language")}>
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {langs.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => {
              void i18n.changeLanguage(l.code);
              localStorage.setItem("i18nextLng", l.code);
            }}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
