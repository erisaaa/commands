export default class Paginator {
  maxLength: number;
  lines: string[] = [];

  constructor(
    protected readonly prefix: string = "```",
    protected readonly suffix: string = "```",
    maxLength = 2000
  ) {
    this.maxLength = maxLength - suffix.length;
  }

  addLine(line: string, emptyAfter = false) {
    this.lines.push(line);
    if (emptyAfter) this.lines.push("");
  }

  addLines(...lines: Array<string | string[]>) {
    this.lines = this.lines.concat(...lines);
  }

  clear() {
    this.lines = [];
  }

  *pages() {
    let thisPage = this.prefix;

    for (const line of this.lines)
      if (thisPage.length === this.maxLength) {
        yield thisPage + this.suffix;
        thisPage = this.prefix;
      } else if (thisPage.length > this.maxLength) {
        const split = thisPage.split("\n");
        const last: string[] = [];

        while (split.join("\n").length > this.maxLength)
          last.push(split.splice(-1, 1)[0]);

        yield split.join("\n") + this.suffix;
        thisPage = this.prefix + last.join("\n");
      } else thisPage += `${line}\n`;

    if (thisPage) yield thisPage + this.suffix;
  }
}
