export type LegalDocumentName = "terms-of-use" | "privacy-policy";
export type ThirdPartyNoticesTarget = "rust" | "npm";

export interface ILegalDocuments {
  getLegalDocument(name: LegalDocumentName): Promise<string>;
  getThirdPartyNotices(target: ThirdPartyNoticesTarget): Promise<string>;
}
