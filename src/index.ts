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
    contextClass: Context
};

export default function setup(erisa: Erisa, options: CommandHandlerOptions): [Matchable, MiddlewareHandler][] {
    const mergedOpts = {
        commandDirectory: (options.commandDirectory || defaults.commandDirectory)!,
        autoLoad: (options.autoLoad !== undefined ? options.autoLoad : defaults.autoLoad)!,
        defaultHelp: (options.defaultHelp !== undefined ? options.defaultHelp : defaults.defaultHelp)!,
        contextClass: (options.contextClass || defaults.contextClass)!,
        owner: options.owner,
        prefixes: options.prefixes
    };
    const holder = erisa.extensions.commands = new Holder(erisa, mergedOpts.prefixes, mergedOpts.owner);

    if (mergedOpts.defaultHelp) holder.add<defaultHelp>(defaultHelp, 'help');

    return [
        [
            'rawWS',
            async function handler({erisa: client, event}, packet: RawPacket) {
                if (packet.op !== Constants.GatewayOPCodes.EVENT || packet.t !== 'MESSAGE_CREATE' ||
                    !packet.d.content || !holder.testPrefix(packet.d.content)[0]) return;

                const ctx = new mergedOpts.contextClass(packet.d, client);

                try {
                    await holder.run(ctx);
                    client.emit('erisa.commands.run', ctx);
                } catch (err) {
                    await ctx.send(`There was an error when trying to run your command:\n${err}`);
                }
            }
        ],
        [
            'ready',
            async function handler({erisa: client}) {
                if (mergedOpts.autoLoad) {
                    await holder.loadAll(mergedOpts.commandDirectory, true);
                    client.emit('erisa.commands.loaded');
                }
            }
        ]
    ];
}
