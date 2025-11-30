import {createContext, useContext} from "react";
import type {CaseEvidence} from "@/types/supabase";

interface CaseEditorContextType {
  evidenceList: CaseEvidence[];
  readOnly: boolean;
}

const CaseEditorContext = createContext<CaseEditorContextType>({
  evidenceList: [],
  readOnly: false,
});

export const useCaseEditorContext = () => useContext(CaseEditorContext);

export function CaseEditorProvider({
                                     children,
                                     evidenceList,
                                     readOnly,
                                   }: {
  children: React.ReactNode;
  evidenceList: CaseEvidence[];
  readOnly: boolean;
}) {
  return (
    <CaseEditorContext.Provider value={{evidenceList, readOnly}}>
      {children}
    </CaseEditorContext.Provider>
  );
}