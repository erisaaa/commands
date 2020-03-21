import Context from './Context';

// Use individual meta interfaces for each overridable that can return a meta, so that users can use
// interface merging to properly type them if they so wish.
export interface PrefixParserMeta {
    [key: string]: any;
}
export interface PreParserMeta {
    [key: string]: any;
}
export type ContextMeta = PrefixParserMeta & PreParserMeta;

// https://stackoverflow.com/a/44466255/8778928
export type PrefixParserResult = [false] | [true, string] | [true, string, PrefixParserMeta];

export type PrefixParser = (content: string, prefixes: (string | RegExp)[]) => PrefixParserResult;
export type CommandPreCheck = (ctx: Context) => Promise<boolean>;
export type PreParser = (content: string) => [string] | [string, PreParserMeta];
export type CommandErrorHandler = (ctx: Context, err: Error, opts: {}) => Promise<void>;
