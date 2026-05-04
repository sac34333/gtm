"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition-all outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "data-[size=default]:h-6 data-[size=default]:w-11",
        "data-[size=sm]:h-5 data-[size=sm]:w-9",
        "bg-slate-700/80",
        "data-[checked]:bg-gradient-to-r data-[checked]:from-indigo-500 data-[checked]:to-violet-500 data-[checked]:border-transparent data-[checked]:shadow-glow-indigo",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/40",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
          "group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4",
          "translate-x-[2px]",
          "group-data-[size=default]/switch:data-[checked]:translate-x-[22px]",
          "group-data-[size=sm]/switch:data-[checked]:translate-x-[18px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
