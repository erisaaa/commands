import Eris from "eris";
import { Erisa } from "erisa";

import { parseArgs, parseOpts } from "./parseArgs";
import Command from "./Command";
import { PrefixParserResult, ContextMeta } from "./types";
import { PrefixMatchException } from "./exceptions";
import { RawPacket } from ".";

export default class Context extends Eris.Message {
  args: string[];
  cmd: string;
  suffix: string;
  opts: { [key: string]: any };
  operands: string[];
  meta?: ContextMeta;
  valid?: boolean = true;

  protected _client: Erisa;

  constructor(data: RawPacket, client: Erisa) {
    super(data, client);

    const preMeta = data.meta
      ? data.meta.reduce((prev, curr) => ({ ...prev, ...curr }), {})
      : {};
    const [
      passed,
      cleaned,
      meta,
    ]: PrefixParserResult = client.extensions.commands.testPrefix(this.content);

    if (!passed) {
      this.valid = false;
      return;
    }

    const { args, cmd, suffix } = parseArgs(cleaned!);
    this.args = args;
    this.cmd = cmd;
    this.suffix = suffix;
    this.meta = { ...preMeta, ...meta };

    const command: Command | undefined = client.extensions.commands.get(cmd);

    if (command?.opts) {
      const opts = parseOpts(this.content, command.opts);

      this.opts = opts;
      this.operands = opts._;
    } else {
      this.opts = {};
      this.operands = [];
    }
  }

  get client() {
    return this._client;
  }

  get guild() {
    return this.channel instanceof Eris.GuildChannel
      ? this.channel.guild
      : undefined;
  }

  get me() {
    return this.guild
      ? this.guild.members.get(this._client.user.id)
      : undefined;
  }

  async send(
    content: Eris.MessageContent | Eris.MessageFile,
    destination?: ContextDestinations
  ): Promise<Eris.Message>;

  async send(
    content: Eris.MessageContent,
    file: Eris.MessageFile,
    destination?: ContextDestinations
  ): Promise<Eris.Message>;

  async send(...args) {
    const potentialDest = args[2] || args[1];
    const dest: Eris.Textable =
      typeof potentialDest === "string"
        ? potentialDest === "author"
          ? await this.author.getDMChannel()
          : this.channel
        : this.channel;
    let ret;

    if (typeof args[0] === "string" || args[0].content)
      // tslint:disable-line prefer-conditional-expression
      ret = dest.createMessage(
        args[0],
        typeof args[1] !== "string" ? args[1] : null
      );
    else if (args[0].file) ret = dest.createMessage("", args[0]);
    else ret = dest.createMessage(args[0], args[1]);

    return ret;
  }

  hasPermission(
    permission: string,
    target: PermissionTargets = "author"
  ): boolean {
    if (!Object.keys(Eris.Constants.Permissions).includes(permission)) {
      if (this._client.extensions.logger)
        this._client.extensions.logger.dispatch(
          "warn",
          `Unknown permission "${permission}"`
        );
      return true;
    }
    if (!(this.channel instanceof Eris.GuildChannel)) return true;

    switch (target) {
      case "self":
        return this.channel.permissionsOf(this._client.user.id).has(permission);
      case "author":
        return this.channel.permissionsOf(this.author.id).has(permission);
      case "both":
        return (
          this.hasPermission(permission) &&
          this.hasPermission(permission, "author")
        );
      default:
        throw new Error(`Unknown target: ${target}`);
    }
  }

  get isBotOwner() {
    return this.author.id === this._client.extensions.commands.owner;
  }
}

export class GuildContext extends Context {
  guild: Eris.Guild;
  me: Eris.Member;
}

export class DMContext extends Context {
  guild: undefined;
  me: undefined;
}

export type ContextDestinations = "channel" | "author";
export type PermissionTargets = "self" | "author" | "both";
