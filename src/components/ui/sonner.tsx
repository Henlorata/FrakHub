import {
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
  AlertTriangle,
} from "lucide-react"
import {Toaster as Sonner, type ToasterProps} from "sonner"

const Toaster = ({...props}: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group font-sans"
      position="top-right"
      offset={{top: 64, right: 16}}
      expand={false}
      visibleToasts={4}
      richColors={false}
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[var(--popover)]/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/40 group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:gap-3",
          description: "group-[.toast]:text-slate-400 group-[.toast]:text-[13px] group-[.toast]:leading-snug",
          actionButton: "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground group-[.toast]:!font-semibold group-[.toast]:!rounded-md",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-white",
          success: "!border-l-[3px] !border-l-emerald-500",
          error: "!border-l-[3px] !border-l-red-500",
          warning: "!border-l-[3px] !border-l-amber-500",
          info: "!border-l-[3px] !border-l-sky-500",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-5 text-emerald-400"/>,
        info: <Info className="size-5 text-sky-400"/>,
        warning: <AlertTriangle className="size-5 text-amber-400"/>,
        error: <XCircle className="size-5 text-red-400"/>,
        loading: <Loader2 className="size-5 animate-spin text-slate-400"/>,
      }}
      {...props}
    />
  )
}

export {Toaster}
