import type {
  ILegalDocuments,
  LegalDocumentName,
  ThirdPartyNoticesTarget,
} from "../../domain/ports/ILegalDocuments";

export async function getLegalDocumentUseCase(
  legal: ILegalDocuments,
  name: LegalDocumentName,
): Promise<string> {
  return legal.getLegalDocument(name);
}

export async function getThirdPartyNoticesUseCase(
  legal: ILegalDocuments,
  target: ThirdPartyNoticesTarget,
): Promise<string> {
  return legal.getThirdPartyNotices(target);
}
