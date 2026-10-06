import {Fragment, type ReactNode} from "react";
import {useSandboxEpoch} from "@/lib/sandbox/state";

/**
 * Remounts everything below when practice mode starts or ends, so every page, context and Realtime
 * channel loads again from the right side (the demo world or the real database).
 */
export function SandboxBoundary({children}: {children: ReactNode}) {
  const epoch = useSandboxEpoch();
  return <Fragment key={epoch}>{children}</Fragment>;
}
