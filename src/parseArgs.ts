import split from 'split-string';
import getopts from 'getopts';
import {ICommandOpts} from './';

const IS_QUOTED = /^(["']).*\1$/;

interface ParsedArguments {
    args: string[];
    cmd: string;
    suffix: string;
}

function splitQuotes(text: string): string[] {
    return split(text, {
        separator: ' ',
        quotes: ['"', "'"]
    }).map(v => IS_QUOTED.test(v) ? v.slice(1, -1) : v); // Removes quotes from quoted strings.
}

/**
 * Parses given text into an argument format used by commands.
 *
 * @param text String to parse.
 */
export function parseArgs(text: string): ParsedArguments {
    const [cmd, ...tmp] = text.split(' ');
    const suffix = tmp.join(' ').trim();
    const args = splitQuotes(suffix).filter(v => v);

    return {
        args,
        cmd,
        suffix
    };
}

export function parseOpts(text: string, options: ICommandOpts) {
    return getopts(splitQuotes(text), options);
}
