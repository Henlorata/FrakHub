import type {CSSProperties} from "react";
import {ArrowRight, BookOpen, CalendarDays, CheckCircle2, Lock, Plus, ShieldCheck, Sunrise} from "lucide-react";
import {Button} from "@/components/ui/button";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {ACADEMY_DAYS, CATEGORY_LABELS, courseLook, cycleDay, isDayOpen, type AcademyOverview, type CourseCategory, type CourseSummary} from "@/lib/academy";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";

interface AcademyCatalogProps {
  overview: AcademyOverview;
  onOpenBasic: (day?: number) => void;
  onOpenCourse: (id: string) => void;
  onNewCourse?: () => void;
}

/** The academy's start page: the basic academy's days and every course with the reader's progress. */
export function AcademyCatalog({overview, onOpenBasic, onOpenCourse, onNewCourse}: AcademyCatalogProps) {
  const {viewer, cycle, basic, courses, today} = overview;
  const day = cycleDay(cycle?.start_date, today);
  const groups = (Object.keys(CATEGORY_LABELS) as CourseCategory[])
    .map((category) => ({category, courses: courses.filter((course) => course.category === category && (viewer.instructor || course.is_open))}))
    .filter((group) => group.courses.length > 0);

  return (
    <div data-tour="academy-catalog" className="space-y-8">
      <section className="panel animate-rise relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-cyan-500/10 blur-3xl"/>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Alapkiképzés</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Trainee akadémia · 5 nap</h2>
            <p className="mt-1 text-sm text-slate-400">
              {cycle
                ? <>Az aktuális ciklus kezdete: {formatDate(cycle.start_date)}{day >= 1 && day <= 5 ? <> · ma: <span className="text-white">{day}. nap</span>.</> : day > 5 ? " · a ciklus véget ért." : " · még nem kezdődött el."}</>
                : "Jelenleg nincs aktív ciklus; az oktatók indítják el."}
              {viewer.trainee && " A napok a ciklus szerint, naponta nyílnak meg."}
            </p>
          </div>
          <Button onClick={() => onOpenBasic(day >= 1 && day <= 5 ? day : 1)} className="bg-cyan-500 text-black hover:bg-cyan-400">
            <BookOpen/> {viewer.trainee ? "Tananyag megnyitása" : "Megnyitás"}
          </Button>
        </div>
        <ol className="relative mt-6 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {ACADEMY_DAYS.map((item) => {
            const open = !viewer.trainee || isDayOpen(item, cycle?.start_date, today);
            const pages = basic.find((entry) => entry.day === item)?.pages ?? 0;
            return (
              <li key={item} style={{"--i": item} as CSSProperties} className="animate-rise">
                <button type="button" disabled={!open} onClick={() => onOpenBasic(item)}
                        className={cn("lift flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors",
                          day === item ? "bg-cyan-500/10 ring-cyan-400/40" : "bg-white/[0.02] ring-white/[0.07]",
                          open ? "hover:bg-white/[0.05]" : "cursor-not-allowed opacity-50")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold",
                    day === item ? "bg-cyan-400 text-black" : "bg-white/[0.06] text-slate-200")}>
                    {open ? item : <Lock className="size-4"/>}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">{item}. nap</span>
                    <span className="block text-[11px] text-slate-500">{pages ? `${pages} oldal` : "nincs oldal"}{day === item ? " · ma" : ""}</span>
                  </span>
                  {day === item && <Sunrise className="ml-auto size-4 text-cyan-300"/>}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{CATEGORY_LABELS[group.category]}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"/>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.courses.map((course, index) => <CourseCard key={course.id} course={course} index={index} instructor={viewer.instructor} onOpen={() => onOpenCourse(course.id)}/>)}
          </div>
        </section>
      ))}

      {viewer.instructor && onNewCourse && (
        <button type="button" onClick={onNewCourse}
                className="lift flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400 transition-colors hover:border-cyan-400/50 hover:text-cyan-200">
          <Plus className="size-4"/> Új tananyag
        </button>
      )}
    </div>
  );
}

function CourseCard({course, index, instructor, onOpen}: {course: CourseSummary; index: number; instructor: boolean; onOpen: () => void}) {
  const look = courseLook(course);
  const tone = TONE_CLASSES[look.tone];
  const percent = course.pages ? Math.round((course.completed / course.pages) * 100) : 0;
  const finished = course.pages > 0 && course.completed >= course.pages;
  return (
    <button type="button" onClick={onOpen} style={{"--i": index} as CSSProperties} data-tour={`academy-course-${course.id}`}
            className={cn("panel lift group animate-rise relative flex flex-col overflow-hidden p-5 text-left", !course.readable && "opacity-75")}>
      <div className={cn("pointer-events-none absolute -top-12 -right-12 size-36 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-90", tone.soft)}/>
      <div className="relative flex items-start gap-3">
        <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", tone.tile)}><look.icon className="size-5"/></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white wrap-anywhere">{course.title}</p>
          <p className="text-xs text-slate-500">{course.pages} oldal{course.required_rank ? ` · ${course.required_rank}+` : ""}</p>
        </div>
        {finished ? <CheckCircle2 className="size-5 shrink-0 text-emerald-400"/> : !course.readable ? <Lock className="size-4 shrink-0 text-slate-500"/> : null}
      </div>
      {course.description && <p className="relative mt-3 line-clamp-2 text-sm text-slate-400">{course.description}</p>}
      <div className="relative mt-auto pt-4">
        {course.readable && course.pages > 0 ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{course.completed}/{course.pages} elolvasva</span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cn("h-full rounded-full bg-gradient-to-r", tone.gradient)} style={{width: `${percent}%`}}/>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            {!course.readable ? (course.rank_ok ? "Még nincs megnyitva." : `${course.required_rank} rendfokozattól.`) : "Feltöltés alatt."}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs">
          {instructor && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1",
              course.is_open ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25" : "bg-amber-500/10 text-amber-200 ring-amber-500/25")}>
              {course.is_open ? <ShieldCheck className="size-3"/> : <Lock className="size-3"/>} {course.is_open ? "Nyitott" : "Zárt"}
            </span>
          )}
          {course.linear_progression && <span className="inline-flex items-center gap-1 text-slate-500"><CalendarDays className="size-3"/> sorrendben</span>}
          <span className="ml-auto inline-flex items-center gap-1 text-slate-300 transition-transform group-hover:translate-x-0.5">
            {course.completed > 0 && !finished ? "Folytatás" : "Megnyitás"} <ArrowRight className="size-3.5"/>
          </span>
        </div>
      </div>
    </button>
  );
}
