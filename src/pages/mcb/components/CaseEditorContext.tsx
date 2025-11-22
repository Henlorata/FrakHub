import React, {createContext, useContext} from 'react';
import type {CaseEvidence} from '@/types/supabase';

interface CaseEditorContextType {
  evidenceList: CaseEvidence[];
  readOnly: boolean;
}

const CaseEditorContext = createContext<CaseEditorContextType | undefined>(undefined);

export const CaseEditorProvider = ({children, evidenceList, readOnly}: {
  children: React.ReactNode,
  evidenceList: CaseEvidence[],
  readOnly: boolean
}) => {
  return (
    <CaseEditorContext.Provider value={{evidenceList, readOnly}}>
      {children}
    </CaseEditorContext.Provider>
  );
};

export const useCaseEditorContext = () => {
  const context = useContext(CaseEditorContext);
  if (!context) {
    throw new Error("useCaseEditorContext must be used within a CaseEditorProvider");
  }
  return context;
};