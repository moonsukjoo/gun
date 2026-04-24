"use client"

import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <div className="bg-emerald-500 rounded-xl p-2 shadow-lg shadow-emerald-200">
            <CircleCheckIcon className="size-5 text-white" />
          </div>
        ),
        info: (
          <div className="bg-blue-500 rounded-xl p-2 shadow-lg shadow-blue-200">
            <InfoIcon className="size-5 text-white" />
          </div>
        ),
        warning: (
          <div className="bg-orange-500 rounded-xl p-2 shadow-lg shadow-orange-200">
            <TriangleAlertIcon className="size-5 text-white" />
          </div>
        ),
        error: (
          <div className="bg-red-500 rounded-xl p-2 shadow-lg shadow-red-200">
            <OctagonXIcon className="size-5 text-white" />
          </div>
        ),
        loading: (
          <div className="bg-slate-500 rounded-xl p-2 shadow-lg shadow-slate-200">
            <Loader2Icon className="size-5 text-white animate-spin" />
          </div>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
