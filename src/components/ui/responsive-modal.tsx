import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Bottom sheet on mobile, centered dialog on desktop/tablet - spec §11.
 * - Radix Dialog handles focus trap + Escape + scroll lock on <body> via
 *   data-scroll-locked so the page behind never scrolls.
 * - `max-h-[85dvh]` + internal scroll keeps long forms usable when the
 *   iOS keyboard opens and shrinks the visual viewport.
 * - Safe-area padding is applied on the sheet variant only, since that's
 *   the one that can sit flush against the bottom edge.
 */
export function ResponsiveModal({ open, onOpenChange, title, children, footer }: ResponsiveModalProps) {
  React.useEffect(() => {
    document.body.dataset.scrollLocked = open ? "true" : "false";
    return () => {
      document.body.dataset.scrollLocked = "false";
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-surface shadow-sheet focus:outline-none",
            // mobile: bottom sheet, full width, rounded top only, safe-area aware
            "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-3xl pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] animate-sheet-up",
            // desktop/tablet: centered card
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6 sm:animate-fade-in"
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between px-5 pt-4">
            <Dialog.Title className="text-lg font-bold text-foreground">{title}</Dialog.Title>
            <Dialog.Close
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="px-5 pt-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
