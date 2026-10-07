import {useState, type KeyboardEvent} from "react";
import {createReactBlockSpec, type ReactCustomBlockRenderProps} from "@blocknote/react";
import {Check, PencilLine, X} from "lucide-react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {cn} from "@/lib/utils";
import {BRAND_IMAGES} from "@/lib/brand";

// The stored block format: never rename the type or its props (case documents and templates use
// them). The logos are referenced by key and served from /public, so no picture is stored.
const letterheadConfig = {
  type: "letterhead",
  propSchema: {
    left: {default: ""},
    right: {default: "mcb"},
    title: {default: "Major Crime’s Bureau"},
    subtitle: {default: "Detective Division"},
    address: {default: "San Fierro, Downtown 1257"},
  },
  content: "none",
} as const;

type LetterheadProps = ReactCustomBlockRenderProps<typeof letterheadConfig>;

/** The logos a letterhead may show (static files of the app, never uploaded). */
export const LETTERHEAD_LOGOS: {key: string; label: string; src?: string}[] = [
  {key: "mcb", label: "MCB címer", src: BRAND_IMAGES.mcb},
  {key: "gangs", label: "GANGS (Operation Safe Street)", src: BRAND_IMAGES.mcbGangs},
  {key: "seb", label: "SEB jelvény", src: BRAND_IMAGES.seb},
  {key: "sfsd", label: "SFSD csillag"},
];

function Logo({name}: {name: string}) {
  const logo = LETTERHEAD_LOGOS.find((item) => item.key === name);
  if (!logo) return <span aria-hidden className="letterhead-logo"/>;
  if (!logo.src) return <SheriffStar className="letterhead-logo"/>;
  return <img src={logo.src} alt={logo.label} className="letterhead-logo object-contain" draggable={false}/>;
}

// Keys typed into the settings must not reach the document editor around the block.
const keep = (event: KeyboardEvent) => event.stopPropagation();

function LetterheadView({block, editor}: LetterheadProps) {
  const [editing, setEditing] = useState(false);
  const {left, right, title, subtitle, address} = block.props;
  const editable = editor.isEditable;
  const setProps = (patch: Partial<typeof block.props>) => editor.updateBlock(block, {props: {...block.props, ...patch}});

  return (
    <div className="group/letterhead relative my-2 w-full select-none" contentEditable={false}>
      {editable && (
        <div className="absolute -top-3 right-0 z-30 flex gap-1 opacity-0 transition group-hover/letterhead:opacity-100 focus-within:opacity-100">
          <button type="button" title={editing ? "Kész" : "Fejléc szerkesztése"} onClick={() => setEditing((value) => !value)}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#0b1220]/95 text-slate-300 shadow-xl hover:text-amber-300">
            {editing ? <Check className="size-3.5"/> : <PencilLine className="size-3.5"/>}
          </button>
          <button type="button" title="Fejléc törlése" onClick={() => editor.removeBlocks([block])}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#0b1220]/95 text-slate-300 shadow-xl hover:bg-red-500/20 hover:text-red-300">
            <X className="size-3.5"/>
          </button>
        </div>
      )}

      <header className="letterhead">
        <Logo name={left}/>
        <div className="letterhead-text">
          {title && <div className="letterhead-title">{title}</div>}
          {subtitle && <div className="letterhead-subtitle">{subtitle}</div>}
          {address && <div className="letterhead-address"><strong>Cím:</strong> {address}</div>}
        </div>
        <Logo name={right}/>
      </header>

      {editable && editing && (
        <div className="letterhead-settings mt-3 grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-[#0b1220]/95 p-3 text-xs text-slate-300 shadow-xl sm:grid-cols-2">
          {([["title", "Megnevezés"], ["subtitle", "Alcím"], ["address", "Cím"]] as const).map(([key, label]) => (
            <label key={key} className={cn("flex flex-col gap-1", key === "title" && "sm:col-span-2")}>
              <span className="text-slate-500">{label}</span>
              <input value={block.props[key]} maxLength={80} onKeyDown={keep} onChange={(event) => setProps({[key]: event.target.value})}
                     className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-slate-100 outline-none focus:border-amber-500/50"/>
            </label>
          ))}
          {([["left", "Bal oldali logó"], ["right", "Jobb oldali logó"]] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-slate-500">{label}</span>
              <select value={block.props[key]} onKeyDown={keep} onChange={(event) => setProps({[key]: event.target.value})}
                      className="h-8 rounded-md border border-white/10 bg-[#0b1220] px-2 text-slate-100 outline-none focus:border-amber-500/50">
                <option value="">Nincs</option>
                {LETTERHEAD_LOGOS.map((logo) => <option key={logo.key} value={logo.key}>{logo.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export const LetterheadBlock = createReactBlockSpec(letterheadConfig, {render: LetterheadView});
