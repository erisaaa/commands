declare module 'split-string' {
    interface AST {
        type: 'string';
        nodes: any[];
        stash: string[];
    }

    interface State {
        input: string;
        separator: string;
        stack: AST[];
        bos(): boolean;
        eoss(): boolean;
        prev(): string;
        next(): string;
    }

    interface Options {
        brackets?: { [key: string]: string } | boolean;
        quotes?: string[] | boolean;
        separator: string;
        strict?: boolean;
        keep?(value: string, state: State): boolean;
    }

    type SplitFunc = (state: State) => boolean;

    function split(input: string): string[];
    function split(input: string, options: Options): string[];
    function split(input: string, fn: SplitFunc): string[];
    function split(input: string, options: Options, fn: SplitFunc): string[]

    export default split;
}
