import {Constants} from 'eris';
import {Erisa, Matchable, MiddlewareHandler} from 'erisa';
import Context from './Context';
import Holder from './Holder';
import {default as defaultHelp} from './defaultHelp';

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

interface RawPacket {
    op: number;
    t?: string;
    d?: any;
    s?: number;
}

interface CommandHandlerOptionsOptionals {
    commandDirectory?: string;
    autoLoad?: boolean;
    defaultHelp?: boolean;
    contextClass?: typeof Context;
    debug?: boolean;
}

interface CommandHandlerOptionsRequired {
    owner: string;
    prefixes: (string | RegExp)[];
}

type CommandHandlerOptions = CommandHandlerOptionsOptionals & CommandHandlerOptionsRequired;

const defaults: CommandHandlerOptionsOptionals = {
    commandDirectory: './commands',
    autoLoad: true,
    defaultHelp: true,
    contextClass: Context,
    debug: false
};

export default function setup(erisa: Erisa, options: CommandHandlerOptions): [Matchable, MiddlewareHandler][] {
    const mergedOpts: CommandHandlerOptions = {...defaults, ...options};
    const holder = erisa.extensions.commands = new Holder(erisa, {
        prefixes: mergedOpts.prefixes,
        owner: mergedOpts.owner,
        debug: mergedOpts.debug!
    });

    if (mergedOpts.defaultHelp) holder.add<defaultHelp>(defaultHelp, 'help');

    return [
        [
            'rawWS',
            async function handler({erisa: client, event}, packet: RawPacket) {
                if (packet.op !== Constants.GatewayOPCodes.EVENT || packet.t !== 'MESSAGE_CREATE' ||
                    !packet.d.content || !holder.testPrefix(packet.d.content)[0]) return;

                const ctx = new mergedOpts.contextClass!(packet.d, client);

                try {
                    await holder.run(ctx);
                    client.emit('erisa.commands.run', ctx);
                } catch (err) {
                    await ctx.send(`There was an error when trying to run your command:\n${mergedOpts.debug ? err.stack : err}`);
                }
            }
        ],
        [
            'ready',
            async function handler({erisa: client}) {
                if (mergedOpts.autoLoad) {
                    await holder.loadAll(mergedOpts.commandDirectory!, true);
                    client.emit('erisa.commands.loaded');
                }
            }
        ]
    ];
}
