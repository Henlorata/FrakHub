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
      expand={true}
      richColors={false} // Saját színeket használunk
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[#0b1221]/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border-l-4 group-[.toaster]:border-y group-[.toaster]:border-r group-[.toaster]:border-slate-800 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-lg group-[.toaster]:p-4",
          description: "group-[.toast]:text-slate-400 group-[.toast]:text-xs group-[.toast]:font-mono",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "group-[.toast]:text-sm group-[.toast]:font-bold group-[.toast]:uppercase group-[.toast]:tracking-wider",

          // Típus specifikus stílusok (Border színek)
          success: "!border-l-green-500 !bg-green-950/10",
          error: "!border-l-red-500 !bg-red-950/10",
          warning: "!border-l-yellow-500 !bg-yellow-950/10",
          info: "!border-l-blue-500 !bg-blue-950/10",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-5 text-green-500"/>,
        info: <Info className="size-5 text-blue-500"/>,
        warning: <AlertTriangle className="size-5 text-yellow-500"/>,
        error: <XCircle className="size-5 text-red-500"/>,
        loading: <Loader2 className="size-5 text-slate-400 animate-spin"/>,
      }}
      {...props}
    />
  )
}

export {Toaster}