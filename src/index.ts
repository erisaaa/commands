import { Constants } from "eris";
import { Erisa, Matchable, MiddlewareHandler } from "erisa";

import Context from "./Context";
import Holder from "./Holder";
import { Help, errorHandler } from "./defaults";
import {
  PrefixParser,
  PreParser,
  PreParserMeta,
  CommandErrorHandler,
} from "./types";

export interface ICommandPermissions {
  self?: string | string[];
  author?: string | string[];
  both?: string | string[];
}

export interface ICommandOpts {
  defaults?: { [key: string]: any };
  boolean?: string[];
  string?: string[];
  unknown?(option: string): boolean;
}

export interface RawPacket {
  op: number;
  t?: string;
  d?: any;
  s?: number;
  meta?: PreParserMeta[];
}

interface CommandHandlerOptionsOptionals<C extends Context = Context> {
  commandDirectory?: string;
  autoLoad?: boolean;
  defaultHelp?: boolean;
  debug?: boolean;
  overrides?: {
    contextClass?: typeof C;
    errorHandler?: CommandErrorHandler;
    prefixParser?: PrefixParser;
    preParsers?: PreParser[];
  };
}

interface CommandHandlerOptionsRequired {
  owner: string;
  prefixes: Array<string | RegExp>;
}

type CommandHandlerOptions<C extends Context> = CommandHandlerOptionsOptionals<
  C
> &
  CommandHandlerOptionsRequired;

const optionDefaults: CommandHandlerOptionsOptionals<any> = {
  commandDirectory: "./commands",
  autoLoad: true,
  defaultHelp: true,
  debug: false,
};

export default function setup<C extends Context = Context>(
  erisa: Erisa,
  options: CommandHandlerOptions<C>
): Array<[Matchable, MiddlewareHandler]> {
  const opts: CommandHandlerOptions<C> = { ...optionDefaults, ...options };
  const { preParsers, prefixParser, errorHandler, contextClass } =
    opts.overrides ??
    ({} as Required<CommandHandlerOptionsOptionals<C>>["overrides"]);
  // eslint-disable-next-line no-multi-assign
  const holder = (erisa.extensions.commands = new Holder(erisa, {
    prefixes: opts.prefixes,
    owner: opts.owner,
    debug: opts.debug!,
    prefixParser,
  }));

  if (opts.defaultHelp) holder.add<Help>(Help, "help");

  return [
    [
      // Use rawWS event instead on onMessage so we get raw packet data, allowing us to create
      // a Context object (which inherits from Message) without having to scrape together all the
      // packet data from that and then end up recreating another instance of the same message.
      "rawWS",
      async function handler({ erisa: client, event }, packet: RawPacket) {
        // Make sure that
        if (
          packet.op !== Constants.GatewayOPCodes.EVENT ||
          packet.t !== "MESSAGE_CREATE" ||
          !packet.d.content
        )
          return;

        // If the user has supplied any preparsers, apply them all to the packet content.
        if (preParsers?.length) {
          const metas: PreParserMeta[] = [];
          let { content } = packet.d;

          for (const parser of preParsers) {
            const [tmp, meta] = parser(content);
            content = tmp;

            if (meta) metas.push(meta);
          }

          if (!holder.testPrefix(content)[0]) return;
          else {
            packet.d.content = content;
            packet.d.meta = metas;
          }
        } else if (!holder.testPrefix(packet.d.content)[0]) return;

        const ctx = new (contextClass || Context)(packet.d, client);

        if (!ctx.valid) return;

        try {
          await holder.run(ctx);
          client.emit("erisa.commands.run", ctx);
        } catch (err) {
          if (errorHandler) await errorHandler(ctx, err, opts);
          else await errorHandler(ctx, err, opts);
        }
      },
    ],
    [
      "ready",
      async function handler({ erisa: client }) {
        if (opts.autoLoad) {
          await holder.loadAll(opts.commandDirectory!, true);
          client.emit("erisa.commands.loaded");
        }
      },
    ],
  ];
}
