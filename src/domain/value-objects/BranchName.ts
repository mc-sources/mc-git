// Valid branch name: no spaces, not starting with -, no .., no special chars
const INVALID_CHARS = /[\s~^:?*\[\\]/;
const INVALID_START = /^[-./]/;
const CONSECUTIVE_DOTS = /\.\./;

export class BranchName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(name: string): BranchName {
    return new BranchName(name.trim());
  }

  get isValid(): boolean {
    const v = this.value;
    return (
      v.length > 0 &&
      !INVALID_CHARS.test(v) &&
      !INVALID_START.test(v) &&
      !CONSECUTIVE_DOTS.test(v) &&
      !v.endsWith(".lock") &&
      !v.endsWith(".")
    );
  }

  toString(): string {
    return this.value;
  }
}
