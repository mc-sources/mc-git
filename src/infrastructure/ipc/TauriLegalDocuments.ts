import { invoke } from "@tauri-apps/api/core";
import type {
  ILegalDocuments,
  LegalDocumentName,
  ThirdPartyNoticesTarget,
} from "../../domain/ports/ILegalDocuments";

export class TauriLegalDocuments implements ILegalDocuments {
  getLegalDocument(name: LegalDocumentName): Promise<string> {
    return invoke<string>("get_legal_document", { name });
  }

  getThirdPartyNotices(target: ThirdPartyNoticesTarget): Promise<string> {
    return invoke<string>("get_third_party_notices", { target });
  }
}
