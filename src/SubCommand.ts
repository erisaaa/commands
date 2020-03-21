import Command from './Command';
import Context from './Context';
import {ICommandPermissions, ICommandOpts} from './';
import {CommandPreCheck} from './types';

interface ISubCommandOptions {
    name?: string;
    overview: string;
    description?: string;
    usage?: string;
    ownerOnly?: boolean;
    guildOnly?: boolean;
    hidden?: boolean;
    aliases?: string[];
    permissions?: ICommandPermissions;
    opts?: ICommandOpts;
}

export default class SubCommand implements Command {
    name: string;
    overview: string;
    description?: string;
    usage?: string;
    ownerOnly?: boolean;
    guildOnly?: boolean;
    hidden?: boolean;
    aliases?: string[];
    permissions?: ICommandPermissions;
    opts?: ICommandOpts;
    readonly subcommands: SubCommand[] = [];
    readonly preChecks: CommandPreCheck[] = [];

    main: (ctx: Context) => Promise<any>;

    constructor(options: ISubCommandOptions, main: (ctx: Context) => Promise<any>) {
        this.name = options.name || '';
        this.overview = options.overview;
        this.description = options.description;
        this.usage = options.usage;
        this.ownerOnly = options.ownerOnly || false;
        this.guildOnly = options.guildOnly || false;
        this.hidden = options.hidden || false;
        this.aliases = options.aliases || [];
        this.permissions = options.permissions;
        this.opts = options.opts;
        this.main = main;
    }
}

// export function decorator(options: ISubCommandOptions) {
//     return function __inner(target: any, property: string, descriptor: PropertyDescriptor) {
//         target['_' + property] = target[property];

//         options.name = options.name ? options.name.toLowerCase() : property.toLowerCase();
//         descriptor.value = () => new SubCommand(options, target['_' + property]);

//         Object.defineProperty(target, '_ ' + property, {
//             enumerable: false
//         });
//     };
// }
