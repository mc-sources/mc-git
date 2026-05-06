import { createContext, useContext } from "react";
import type { ILegalDocuments } from "../domain/ports/ILegalDocuments";
import { TauriLegalDocuments } from "./ipc/TauriLegalDocuments";

const instance: ILegalDocuments = new TauriLegalDocuments();

const LegalDocumentsContext = createContext<ILegalDocuments>(instance);

export function LegalDocumentsProvider({ children }: { children: React.ReactNode }) {
  return (
    <LegalDocumentsContext.Provider value={instance}>
      {children}
    </LegalDocumentsContext.Provider>
  );
}

export function useLegalDocuments(): ILegalDocuments {
  return useContext(LegalDocumentsContext);
}
