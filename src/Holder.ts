import { Erisa } from "erisa";

import { default as fs_, promises as fs } from "fs";

import Command from "./Command";
import { PermissionStrings } from "./Constants";
import Context, { PermissionTargets } from "./Context";
import SubCommand from "./SubCommand";
import { PrefixParser } from "./types";
import { prefixParser } from "./defaults";

type Ctor<T> = new (...args: any[]) => T;

async function walk(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  let ret: string[] = [];

  for (const f of files)
    if ((await fs.stat(`${dir}${f}`)).isDirectory())
      ret = ret.concat(await walk(`${dir}${f}/`));
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
  loadCommands = true;
  useCommands = false;
  prefixes: Array<string | RegExp>;
  owner: string;
  debug: boolean;
  private prefixParser?: PrefixParser;

  testPrefix: (content: string) => ReturnType<PrefixParser> = this.prefixParser
    ? (content: string) => this.prefixParser!(this.prefixes, content)
    : (content: string) => prefixParser(this.prefixes, content);

  constructor(
    protected readonly client: Erisa,
    options: {
      prefixes: Array<string | RegExp>;
      owner: string;
      debug: boolean;
      prefixParser?: PrefixParser;
    }
  ) {
    this.prefixes = options.prefixes;
    this.owner = options.owner;
    this.debug = options.debug;
    this.prefixParser = options.prefixParser;
  }

  /**
   * Loads all the commands found within a given directory.
   *
   * @param directory Directory to find commands in.
   * @param deep Whether to look in nested directories for more commands.
   */
  async loadAll(dir: string, deep = false): Promise<void> {
    const files: string[] = (
      await Promise.all(await (deep ? walk(dir) : fs.readdir(dir)))
    ).filter(async (f) => (await fs.stat(f)).isDirectory());

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
    if (this.modules.get(mod))
      throw new Error(`Command module '${mod}' is already loaded.`);

    let module: Array<Ctor<Command>> | Ctor<Command> = (await import(mod))
      .default;

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
  async add<T extends Command>(
    command: Ctor<T>,
    mod: string
  ): Promise<Command> {
    const cmd = new command(this.client);

    if (cmd.init) await cmd.init();

    cmd.name = cmd.name ? cmd.name.toLowerCase() : command.name.toLowerCase();

    if (!cmd.overview)
      throw new Error(
        `Command '${cmd.name}' in module '${mod}' is missing 'overview' property`
      );
    if (!cmd.main)
      throw new Error(
        `Command '${cmd.name}' in module '${mod}' is missing 'main' method.`
      );

    const cmdMethods = Object.getOwnPropertyNames(
      cmd.constructor.prototype
    ).filter((v) => !["constructor", "main", "init"].includes(v));

    for (const subcommand of cmdMethods) {
      const result = cmd[subcommand]();

      if (!(result instanceof SubCommand)) continue;

      cmd.subcommands.push(result);
    }

    this.commands.set(cmd.name, cmd);

    if (!this.modules.get(mod)) this.modules.set(mod, [cmd.name]);
    else this.modules.set(mod, this.modules.get(mod)!.concat(cmd.name));

    if (cmd.aliases)
      for (const alias of cmd.aliases) {
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
    if (!this.modules.get(mod))
      throw new Error(`Command module '${mod} isn't loaded.`);

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

    // TODO: use a map instead dummy
    if (ctx.args.length)
      // TODO: did I forget to pop args?
      for (const arg of ctx.args)
        if (
          cmd.subcommands.length &&
          cmd.subcommands.find((sub) => sub.name === arg)
        )
          cmd = cmd.subcommands.find((sub) => sub.name === arg)!;

    if (cmd.guildOnly && !ctx.guild)
      return ctx.send("This command can only be run in a server.");

    if (cmd.preChecks.length)
      for (const check of cmd.preChecks) if (!(await check(ctx))) return;

    if (cmd.ownerOnly && ctx.isBotOwner) await cmd.main(ctx);
    else if (!cmd.ownerOnly) {
      const perms = this.handlePermissions(cmd, ctx);

      if (perms[0]) await cmd.main(ctx);
      else {
        const [, field, permission] = perms as [
          false,
          PermissionTargets,
          string
        ];
        const permString = PermissionStrings[permission];
        const msg =
          field === "self" || !ctx.hasPermission(permission)
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
  private handlePermissions(
    cmd: Command,
    ctx: Context
  ): [true] | [false, PermissionTargets, string] {
    if (!cmd.permissions) return [true];

    const permChecks: {
      both: string[];
      author: string[];
      self: string[];
    } = {
      both: [],
      author: [],
      self: [],
    };

    for (const type of ["both", "author", "self"]) {
      const target =
        type === "both" ? "both" : type === "author" ? "author" : "self";

      if (!cmd.permissions[type]) continue;

      if (Array.isArray(cmd.permissions[type]))
        permChecks[type] = cmd.permissions[type].filter((perm) =>
          ctx.hasPermission(perm, target)
        );
      else if (ctx.hasPermission(cmd.permissions[type], target))
        permChecks[type].push(cmd.permissions[type]);
    }

    // Array of [command permissions, actual permissions] is the corresponding field for the command exists, otherwise null.
    let scope = "";
    const totalPerms: {
      both: [string | string[], string[]] | null;
      author: [string | string[], string[]] | null;
      self: [string | string[], string[]] | null;
    } = {
      both:
        cmd.permissions.both && cmd.permissions.both.length
          ? [cmd.permissions.both, permChecks.both]
          : null,
      author:
        cmd.permissions.author && cmd.permissions.author.length
          ? [cmd.permissions.author, permChecks.author]
          : null,
      self:
        cmd.permissions.self && cmd.permissions.self.length
          ? [cmd.permissions.self, permChecks.self]
          : null,
    };
    const allEqual = Object.entries(totalPerms)
      .filter(([, value]) => value) // Filter out null values.
      .reduce((m, [key, value]) => {
        if (value === null) return m;

        const cmdPerms: string[] = (Array.isArray(value[0])
          ? value[0]
          : [value[0]]
        ).sort();
        const actualPerms = value[1].sort();

        if (actualPerms.length !== cmdPerms.length) {
          scope = key;
          return false;
        }

        for (const perm of cmdPerms)
          if (!actualPerms.includes(perm)) {
            scope = key;
            return false;
          }

        return m;
      }, true);

    if (allEqual) return [true];
    else {
      const perms: [string | string[], string[]] = totalPerms[scope];
      const cmdPerms: string[] = (Array.isArray(perms[0])
        ? perms[0]
        : [perms[0]]
      ).sort();
      const actualPerms = perms[1].sort();
      let missingPerm = "";

      for (const perm of cmdPerms)
        if (!actualPerms.includes(perm)) {
          missingPerm = perm;
          break;
        }

      if (!missingPerm)
        throw new Error(
          `Unable to find perm for scope ${scope}. This shouldn't happen, please report it.`
        );

      return [false, scope as PermissionTargets, missingPerm];
    }
  }

  /**
   * Gets a mod either by an alias or normal name.
   *
   * @param cmd Command to try and get.
   * @returns The matching command if it exists.
   */
  get(cmd: string): Command | undefined {
    return this.aliases.get(cmd) ?? this.commands.get(cmd);
  }

  forEach(
    cb: (value: Command, key: string, map: Map<string, Command>) => void
  ): void {
    this.commands.forEach(cb);
  }

  filter(
    cb: (value: Command, key: string, map: Map<string, Command>) => boolean
  ): Command[] {
    const filtered: Command[] = [];

    for (const [name, cmd] of this)
      if (cb(cmd, name, this.commands)) filtered.push(cmd);

    return filtered;
  }

  /**
   * Returns a list of all categories that have at least one command under them.
   */
  get categories() {
    return Array.from(this.commands.entries()).reduce(
      (m, [_, c]) =>
        c.category && !m.includes(c.category) ? m.concat(c.category) : m,
      [] as Array<string | null>
    );
  }

  /**
   * Sorts commands into objects containing their matching category and other commands with the same category.
   * Commands with no set category are listed under `category: null`.
   *
   * @returns An array of objects matching commands to categories.
   */
  get commandsByCategory() {
    return this.categories.concat(null).map((c) => ({
      category: c,
      commands: Array.from(this.commands.entries())
        .filter(
          ([_, v]) => (c ? v.category === c : v.category == c) // tslint:disable-line
          // This is for matching commands without a category, as undefined can coerce to null.
        )
        .map(([_, v]) => v),
    }));
  }

  [Symbol.iterator]() {
    return this.commands[Symbol.iterator]();
  }
}
