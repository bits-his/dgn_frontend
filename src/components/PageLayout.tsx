import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import BackButton from "@/components/BackButton";
import { cn } from "@/lib/utils";

/**
 * Consistent app page shell: gray background + single shadcn Card
 * with header (title, description, actions) and content body.
 *
 * Use `back` on create/detail pages back sits on the right of the header row.
 */
export function PageLayout({
  title,
  description,
  actions,
  back = false,
  backTo,
  backLabel = "Back",
  onBack,
  children,
  className,
  contentClassName,
  headerClassName,
  cardClassName,
  bare = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: boolean;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  cardClassName?: string;
  bare?: boolean;
}) {
  const hasHeader = back || title || description || actions;

  const headerBlock = hasHeader ? (
    <div className={cn("flex flex-col ", headerClassName)}>
      {back ? (
        <div className="mb-0.5">
          <BackButton text={backLabel} to={backTo} onClick={onBack} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          {title ? (
            bare ? (
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl truncate">
                {title}
              </h1>
            ) : (
              <CardTitle className="text-lg font-bold tracking-tight sm:text-xl md:text-2xl truncate">
                {title}
              </CardTitle>
            )
          ) : null}
          {description && !back ? (
            bare ? (
              <p className="hidden sm:block text-[11px] text-muted-foreground sm:text-xs">
                {description}
              </p>
            ) : (
              <CardDescription className="hidden sm:block text-[11px] text-muted-foreground sm:text-xs">
                {description}
              </CardDescription>
            )
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  if (bare) {
    return (
      <div
        className={cn(
          "flex min-h-full flex-1 flex-col gap-1.5 bg-gray-50 p-1 sm:p-2 md:p-3",
          className
        )}
      >
        {headerBlock}
        <div className={cn("flex flex-1 flex-col gap-1.5", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col bg-gray-50 p-0 md:p-1",
        className
      )}
    >
      <Card
        className={cn(
          "m-0 flex flex-1 flex-col border-gray-200/80 p-0 shadow-none",
          cardClassName
        )}
      >
        {hasHeader ? (
          <CardHeader className="space-y-0 border-b border-border/60 px-3 py-2.5 sm:px-4 sm:py-3">
            {headerBlock}
          </CardHeader>
        ) : null}

        <CardContent
          className={cn(
            "flex flex-1 flex-col gap-2 p-2 sm:p-2.5 md:p-3 min-h-0",
            contentClassName
          )}
        >
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default PageLayout;
