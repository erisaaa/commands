import split from 'split-string';

const IS_QUOTED = /^(["']).*\1$/;

interface ParsedArguments {
    args: string[];
    cmd: string;
    suffix: string;
}

export default function parseArgs(text: string): ParsedArguments {
    const [cmd, ...tmp] = text.split(' ');
    const suffix = tmp.join(' ').trim();
    const args = split(suffix, {
        separator: ' ',
        quotes: ['"', "'"]
    }).map(v => IS_QUOTED.test(v) ? v.slice(1, -1) : v);

    return {
        args,
        cmd,
        suffix
    };
}
