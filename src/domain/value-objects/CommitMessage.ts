export const SUBJECT_MAX_LENGTH = 72;

export class CommitMessage {
  readonly subject: string;
  readonly body: string | null;

  private constructor(subject: string, body: string | null) {
    this.subject = subject;
    this.body = body;
  }

  static create(subject: string, body?: string): CommitMessage {
    const trimmedBody = body?.trim() || null;
    return new CommitMessage(subject.trim(), trimmedBody);
  }

  get isSubjectValid(): boolean {
    return this.subject.length > 0 && this.subject.length <= SUBJECT_MAX_LENGTH;
  }

  get subjectLength(): number {
    return this.subject.length;
  }

  get isSubjectTooLong(): boolean {
    return this.subject.length > SUBJECT_MAX_LENGTH;
  }

  toString(): string {
    return this.body ? `${this.subject}\n\n${this.body}` : this.subject;
  }
}
