"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

const collapsibleVariants = {
  default: "border border-dashed bg-slate-100 dark:bg-slate-800",
}

export interface CollapsibleProps
  extends React.ComponentPropsWithoutRef<typeof DivPrimitive.div> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const DivPrimitive = React.forwardRef<
  React.ElementRef<typeof React.div>,
  React.ComponentPropsWithoutRef<typeof React.div>
>((({ className, ...props }, ref) => {
  return (
    <React.div ref={ref} className={cn(className)} {...props} />
  )
}));
DivPrimitive.displayName = "DivPrimitive"

const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.div>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.div>
>(({ open, onOpenChange, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(open);
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setIsOpen(nextOpen);
    }
  }, [onOpenChange]);

  return (
    <CollapsiblePrimitive.Provider
      value={{ isOpen, onOpenChange: handleOpenChange }}
    >
      <CollapsiblePrimitive.div ref={ref} {...props}>
        {children}
      </CollapsiblePrimitive.div>
    </CollapsiblePrimitive.Provider>
  );
});
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.button>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.button>
>(({ className, children, ...props }, ref) => {
  const { isOpen, onOpenChange } = React.useContext(CollapsibleContext)

  return (
    <CollapsiblePrimitive.button
      ref={ref}
      className={cn(
        "flex items-center justify-between w-full text-sm font-medium transition-colors hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className={cn(
          "h-4 w-4 transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </CollapsiblePrimitive.button>
  )
});
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.div>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.div>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = React.useContext(CollapsibleContext)

  if (!isOpen) return null

  return (
    <CollapsiblePrimitive.div
      ref={ref}
      className={cn("mt-2 text-sm", className)}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.div>
  )
});
CollapsibleContent.displayName = "CollapsibleContent"

// Context for collapsible state
const CollapsibleContext = React.createContext<
  {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
  } | null
>(null)

// Primitive components
const CollapsiblePrimitive = {
  Provider: CollapsibleContext.Provider,
  div: DivPrimitive,
  button: React.forwardRef<
    React.ElementRef<typeof React.button>,
    React.ComponentPropsWithoutRef<typeof React.button>
  >(({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    />
  )),
};

// Icons
const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent }