import {default as fs_, promises as fs} from 'fs';
import {Erisa} from 'erisa';
import Command from './Command';
import {PermissionStrings} from './Constants';
import Context, {PermissionTargets} from './Context';
import SubCommand from './SubCommand';

interface Ctor<T> {
    new(...args: any[]): T;
}

async function walk(dir: string): Promise<string[]> {
    const files = await fs.readdir(dir);
    let ret: string[] = [];

    for (const f of files)
        if ((await fs.stat(`${dir}${f}`)).isDirectory()) ret = ret.concat(await walk(`${dir}${f}/`));
        else ret.push(`${dir}${f}`);

    return ret;
}

/**
 * An object for containing a bunch of commands with methods to load and run them.
 */
export default class Holder {
    readonly commands: Map<string, Command> = new Map<string, Command>();
    readonly aliases: Map<string, Command> = new Map<string, Command>();
    readonly modules: Map<string, string[]> = new Map<string, string[]>();
    public loadCommands: boolean = true;
    public useCommands: boolean = false;

    constructor(readonly client: Erisa, public prefixes: (string | RegExp)[], public owner: string) {}

    /**
     * Loads all the commands found within a given directory.
     *
     * @param directory Directory to find commands in.
     * @param deep Whether to look in nested directories for more commands.
     */
    async loadAll(dir: string, deep: boolean = false): Promise<void> {
        const files: string[] = (await Promise.all(await (deep ? walk(dir) : fs.readdir(dir))))
            .filter(async f => (await fs.stat(f)).isDirectory());

        for (const f of files)
            try {
                await this.load(f);
            } catch (err) {
                // TODO: integrate with the logger module if it exists.
            }
    }

    /**
     * Attempts to load commands from a given module.
     *
     * @param mod Path of a module containing commands.
     */
    async load(mod: string): Promise<void> {
        if (this.modules.get(mod)) throw new Error(`Command module '${mod}' is already loaded.`);

        let module: Ctor<Command>[] | Ctor<Command> = (await import(mod)).default;

        if (!Array.isArray(module)) module = [module];

        for (const command of module) await this.add(command, mod);

        if (!this.modules.get(mod)) {
            this.modules.delete(mod);
            delete require.cache[require.resolve(mod)];
        }
    }

    /**
     * Adds a given command to the command holder, properly assigning name, aliases, etc.
     *
     * @param command Command constructor to add.
     * @param mod Module name to register the command under.
     * @returns The constructed command, in case it's needed.
     */
    async add<T extends Command>(command: Ctor<T>, mod: string): Promise<Command> {
        const cmd = new command(this.client);

        if (cmd.init) await cmd.init();

        cmd.name = cmd.name ? cmd.name.toLowerCase() : command.name.toLowerCase();

        if (!cmd.overview) throw new Error(`Command '${cmd.name}' in module '${mod}' is missing 'overview' property`);
        if (!cmd.main) throw new Error(`Command '${cmd.name}' in module '${mod}' is missing 'main' method.`);

        const cmdMethods = Object.getOwnPropertyNames(cmd.constructor.prototype)
            .filter(v => !['constructor', 'main', 'init'].includes(v));

        for (const subcommand of cmdMethods) {
            const result = cmd[subcommand]();

            if (!(result instanceof SubCommand)) continue;

            cmd.subcommands.push(result);
        }

        this.commands.set(cmd.name, cmd);

        if (!this.modules.get(mod)) this.modules.set(mod, [cmd.name]);
        else this.modules.set(mod, this.modules.get(mod)!.concat(cmd.name));

        if (cmd.aliases) for (const alias of cmd.aliases) {
            this.aliases.set(alias, this.commands.get(cmd.name)!);
            this.modules.set(mod, this.modules.get(mod)!.concat(alias));
        }

        return cmd;
    }

    /**
     * Removes all loaded commands from a given module.
     *
     * @param mod Path of the module to unload commands from.
     */
    unload(mod: string): void {
        if (!this.modules.get(mod)) throw new Error(`Command module '${mod} isn't loaded.`);

        for (const cmd of this.modules.get(mod)!) {
            if (this.aliases.get(cmd)) this.aliases.delete(cmd);
            if (this.commands.get(cmd)) this.commands.delete(cmd);
        }

        this.modules.delete(mod);
        delete require.cache[require.resolve(mod)];
    }

    /**
     * Attempts to reload all commands in a given module.
     *
     * @param mod Path of the module to reload.
     */
    reload(mod: string): void {
        // Will implicitly load the module if it hasn't been so already (this if will be false and fall through).
        if (this.modules.get(mod)) this.unload(mod);

        this.load(mod);
    }

    /**
     * Attempts to run a command based on a given context.
     *
     * @param ctx Context to run from.
     */
    async run(ctx: Context): Promise<void> {
        let cmd = this.commands.get(ctx.cmd);

        if (!cmd) return;

        if (ctx.args.length)
            for (const arg of ctx.args)
                if (cmd.subcommands.length && cmd.subcommands.find(sub => sub.name === arg))
                    cmd = cmd.subcommands.find(sub => sub.name === arg)!;

        if (cmd.guildOnly && !ctx.guild)
            return void ctx.send('This command can only be run in a server.');

        if (cmd.ownerOnly && ctx.isBotOwner)
            await cmd.main(ctx);
        else if (!cmd.ownerOnly) {
            const perms = this.handlePermissions(cmd, ctx);

            if (perms[0]) await cmd.main(ctx);
            else {
                const [, field, permission] = perms as [false, PermissionTargets, string];
                const permString = PermissionStrings[permission];
                const msg = (field === 'self' || !ctx.hasPermission(permission))
                    ? `I am missing the **${permString}** permission.`
                    : `You are missing the **${permString}** Permission.`;

                await ctx.send(msg);
            }
        }
    }

    /**
     * Determines whether or not a context matches the permission for its command.
     *
     * @param cmd Command to check the context against.
     * @param ctx Context to compare with the command.
     * @returns First item is a boolean for whether or not all the checks are met. If false, the second item is the missing scope, and the third item is the missing permission.
     */
    handlePermissions(cmd: Command, ctx: Context): [true] | [false, PermissionTargets, string] {
        if (!cmd.permissions) return [true];

        const permChecks = {
            both: [] as string[],
            author: [] as string[],
            self: [] as string[]
        };

        for (const type of ['both', 'author', 'self']) {
            const target = type === 'both'
                ? 'both'
                : type === 'author'
                    ? 'author'
                    : 'self';

            if (Array.isArray(cmd.permissions[type]))
                permChecks[type] = cmd.permissions[type].filter(perm => ctx.hasPermission(perm, target));
            else if (ctx.hasPermission(cmd.permissions[type], target))
                permChecks[type].push(cmd.permissions[type]);
        }

        interface PermTuples {
            both: [any, any];
            author: [any, any];
            self: [any, any];
        }

        const zip = rows => rows[0].map((_, c) => rows.map(row => row[c]));

        const zippedPerms: PermTuples = ['both', 'author', 'self'].map(k =>
            [cmd.permissions![k] || null, permChecks[k] || null, k]
        ).reduce((m, [x, y, k]) => {
            m[k] = [Array.isArray(x) ? x : [x], y];
            return m;
        }, {} as PermTuples);
        const allEqual = Object.entries(zippedPerms).reduce((m, [, [cPerm, uPerm]]) => {
            if (!cPerm) return m;
            else if (!uPerm || cPerm.length !== uPerm.length) return false;

            for (const [c, u] of zip([cPerm.sort(), uPerm.sort()]))
                if (c !== u) return false;

            // If `m` was false before, this will continue to be false all the way through.
            return m && true;
        }, true);

        if (allEqual) return [true];
        else {
            const missingScope: PermissionTargets = Object.entries(zippedPerms).find(([, [cPerm, uPerm]]) => {
                for (const [c, u] of zip([cPerm.sort(), uPerm.sort()]))
                    if (c !== u) return true;

                return false;
            })![0] as any;

            const missingPerm: string = zippedPerms[missingScope].find(([cPerm, uPerm]) => {
                for (const [c, u] of zip([cPerm.sort(), uPerm.sort()]))
                    if (c !== u) return true;

                // This should never be reached
                throw new Error('Unable to find missingPerm in missingScope.');
            });

            return [false, missingScope, missingPerm];
        }
    }

    testPrefix(content: string): [false] | [true, string] {
        let ret: [false] | [true, string] = [false];

        for (const prefix of this.prefixes)
            if (typeof prefix === 'string' && content.startsWith(prefix)) {
                ret = [true, content.slice(prefix.length).trim()];
                break;
            } else if (prefix instanceof RegExp && prefix.test(content) && content.match(prefix)![1]) {
                ret = [true, content.match(prefix)![1].trim()];
                break;
            }

        return ret;
    }

    /**
     * Gets a mod either by an alias or normal name.
     *
     * @param cmd Command to try and get.
     * @returns The matching command if it exists.
     */
    get(cmd: string): Command | undefined {
        return this.aliases.get(cmd) || this.commands.get(cmd);
    }

    forEach(cb: (value: Command, key: string, map: Map<string, Command>) => void): void {
        this.commands.forEach(cb);
    }

    filter(cb: (value: Command, key: string, map: Map<string, Command>) => boolean): Command[] {
        const filtered: Command[] = [];

        for (const [name, cmd] of this) if (cb(cmd, name, this.commands)) filtered.push(cmd);

        return filtered;
    }

    /**
     * Returns a list of all categories that have at least one command under them.
     */
    get categories() {
        return Array.from(this.commands.entries()).reduce((m, [_, c]) => c.category && !m.includes(c.category) ? m.concat(c.category) : m, [] as (string | null)[]);
    }

    /**
     * Sorts commands into objects containing their matching category and other commands with the same category.
     * Commands with no set category are listed under `category: null`.
     *
     * @returns An array of objects matching commands to categories.
     */
    get commandsByCategory() {
        return this.categories.concat(null).map(c => ({
            category: c,
            commands: Array.from(this.commands.entries()).filter(([_, v]) => c
                ? v.category === c
                : v.category == c // tslint:disable-line
                // This is for matching commands without a category, as undefined can coerce to null.
            ).map(([_, v]) => v)
        }));
    }

    [Symbol.iterator]() {
        return this.commands[Symbol.iterator]();
    }
}
