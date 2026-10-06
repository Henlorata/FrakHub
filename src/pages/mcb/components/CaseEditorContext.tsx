import {createContext, useContext, type ReactNode} from "react";
import type {CaseEvidence} from "@/types/supabase";

export type MentionRole = "officer" | "suspect" | "case";

interface CaseEditorContextType {
  evidenceList: CaseEvidence[];
  /** Evidence number (#1 = first upload of the case). */
  numbers: Map<string, number>;
  readOnly: boolean;
  /** Light document themes (paper, classic) need dark-on-light chips and cards. */
  light: boolean;
  onOpenEvidence: (evidenceId: string) => void;
  onMention: (role: MentionRole, id: string) => void;
}

const CaseEditorContext = createContext<CaseEditorContextType>({
  evidenceList: [],
  numbers: new Map(),
  readOnly: false,
  light: false,
  onOpenEvidence: () => undefined,
  onMention: () => undefined,
});

export const useCaseEditorContext = () => useContext(CaseEditorContext);

export function CaseEditorProvider({children, ...value}: CaseEditorContextType & {children: ReactNode}) {
  return <CaseEditorContext.Provider value={value}>{children}</CaseEditorContext.Provider>;
}
