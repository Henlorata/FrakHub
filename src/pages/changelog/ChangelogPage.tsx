import {useEffect, type CSSProperties} from "react";
import {Link} from "react-router";
import {ArrowRight, Sparkles} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {RELEASES} from "@/data/changelog";
import {markChangelogSeen} from "@/lib/changelog";
import {monthLabel} from "@/lib/registry";

/** Release notes for the members: what is new and where to try it. */
export function ChangelogPage() {
  // Opening the page counts as seen (the dashboard strip goes away).
  useEffect(() => markChangelogSeen(), []);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-10">
      <PageHeader icon={Sparkles} eyebrow="Változásnapló" title="Újdonságok"
                  description="Mi változott az oldalon, és hol próbálhatod ki. A képzéseket a profilodon bármikor újrajátszhatod."/>

      {RELEASES.map((release) => (
        <section key={release.id} className="space-y-4" aria-labelledby={`release-${release.id}`}>
          <header className="space-y-1 px-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">{monthLabel(`${release.month}-01`)}</p>
            <h2 id={`release-${release.id}`} className="text-xl font-semibold text-white">{release.title}</h2>
            <p className="max-w-3xl text-sm text-slate-400">{release.summary}</p>
          </header>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {release.items.map((item, index) => (
              <li key={`${item.area}-${item.title}`} style={{"--i": Math.min(index, 12)} as CSSProperties}
                  className="panel animate-rise flex min-w-0 flex-col gap-2 p-4">
                <span className="self-start rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/25">{item.area}</span>
                <h3 className="text-sm font-semibold text-white wrap-anywhere">{item.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-slate-300 wrap-anywhere">{item.text}</p>
                {item.link && (
                  <Link to={item.link} className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary/90 hover:text-primary">
                    Megnyitás <ArrowRight className="size-3.5"/>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
