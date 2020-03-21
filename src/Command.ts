import Context from './Context';
import SubCommand from './SubCommand';
import {ICommandPermissions, ICommandOpts} from './';
import { CommandPreCheck } from './types';
import Erisa from 'erisa';

export default abstract class Command {
    name?: string;
    abstract readonly overview: string;
    readonly description?: string;
    readonly usage?: string;
    readonly ownerOnly?: boolean;
    readonly guildOnly?: boolean;
    readonly hidden?: boolean;
    readonly aliases?: string[];
    readonly category?: string;
    readonly permissions?: ICommandPermissions;
    readonly opts?: ICommandOpts;
    readonly subcommands: SubCommand[] = [];
    readonly preChecks: CommandPreCheck[] = [];

    async init?(): Promise<void>;
    abstract async main(ctx: Context): Promise<any>;
}
