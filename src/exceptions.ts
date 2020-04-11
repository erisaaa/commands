export class PrefixMatchException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrefixMatchException";
  }
}
