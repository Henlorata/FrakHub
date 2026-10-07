import {titleIcon, titlesOf, titleTone, useBureauCatalog} from "@/lib/bureaus";
import {cn} from "@/lib/utils";

/**
 * A member's bureau titles (SEB: Medic, Marksman, ...) with their own icon, held next to the
 * bureau rank. Loads the bureau catalogue on first use (one cached call per session).
 */
export function DivisionTitleBadges({ids, size = "sm", compact, className}: {
  ids?: readonly string[] | null;
  size?: "sm" | "md";
  /** Icons only (the name in the tooltip), for tight places such as the org chart. */
  compact?: boolean;
  className?: string;
}) {
  const catalog = useBureauCatalog(!!ids?.length);
  const titles = titlesOf(ids, catalog);
  if (!titles.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {titles.map((title) => {
        const Icon = titleIcon(title.icon);
        if (compact) {
          return (
            <span key={title.id} title={title.name} aria-label={title.name}
                  className={cn("inline-grid size-4 place-items-center rounded ring-1", titleTone(title.tone).chip)}>
              <Icon className="size-2.5"/>
            </span>
          );
        }
        return (
          <span key={title.id} title={title.description ?? title.name}
                className={cn("inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap ring-1", titleTone(title.tone).chip,
                  size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs")}>
            <Icon className={size === "sm" ? "size-3" : "size-3.5"}/>{title.name}
          </span>
        );
      })}
    </span>
  );
}
