export function prefixParser(
  content: string,
  prefixes: Array<string | RegExp>
): [false] | [true, string] {
  let ret: [false] | [true, string] = [false];

  for (const prefix of prefixes)
    if (typeof prefix === "string" && content.startsWith(prefix)) {
      ret = [true, content.slice(prefix.length).trim()];
      break;
    } else if (
      prefix instanceof RegExp &&
      prefix.test(content) &&
      content.match(prefix)![1]
    ) {
      ret = [true, content.match(prefix)![1].trim()];
      break;
    }

  return ret;
}
