import Eris from 'eris';
import {parseArgs, parseOpts} from './parseArgs';
import Command from './Command';
import {Erisa} from 'erisa';

export default class Context extends Eris.Message {
    public args: string[];
    public cmd: string;
    public suffix: string;
    public opts: { [key: string]: any };
    public operands: string[];
    public me?: Eris.Member;

    protected _client: Erisa;

    constructor(data, client) {
        super(data, client);

        const parsed: [false] | [true, string] = client.extensions.commands.testPrefix(this.content);

        if (!parsed[0]) throw new Error('Context content does not match a known prefix');

        const {args, cmd, suffix} = parseArgs(parsed[1] as string);
        this.args = args;
        this.cmd = cmd;
        this.suffix = suffix;

        const command: Command | undefined = client.extensions.commands.get(cmd);

        if (command && command.opts) {
            const opts = parseOpts(this.content, command.opts);

            this.opts = opts;
            this.operands = opts._;
        } else {
            this.opts = {};
            this.operands = [];
        }

        this.me = this.guild ? this.guild.members.get(client.user.id) : undefined;
    }

    get guild() {
        return this.channel instanceof Eris.GuildChannel ? this.channel.guild : undefined;
    }

    async send(content: Eris.MessageContent, destination?: ContextDestinations): Promise<Eris.Message>;
    async send(file: Eris.MessageFile, destination?: ContextDestinations): Promise<Eris.Message>;
    async send(content: Eris.MessageContent, file: Eris.MessageFile, destination?: ContextDestinations): Promise<Eris.Message>;

    async send(...args) {
        const potentialDest = args[2] || args[1] ;
        const dest: Eris.Textable = typeof potentialDest === 'string' ? (
            potentialDest === 'author'
                ? await this.author.getDMChannel()
                : this.channel
        ) : this.channel;
        let ret;

        if (typeof args[0] === 'string' || args[0].content) // tslint:disable-line prefer-conditional-expression
            ret = dest.createMessage(args[0], typeof args[1] !== 'string' ? args[1] : null);
        else if (args[0].file)
            ret = dest.createMessage('', args[0]);
        else
            ret = dest.createMessage(args[0], args[1]);

        return ret;
    }

    hasPermission(permission: string, target: PermissionTargets = 'author'): boolean {
        if (!Object.keys(Eris.Constants.Permissions).includes(permission)) {
            if (this._client.extensions.logger) this._client.extensions.logger.dispatch('warn', `Unknown permission "${permission}"`);
            return true;
        }
        if (!(this.channel instanceof Eris.GuildChannel)) return true;

        switch (target) {
            case 'self':
                return this.channel.permissionsOf(this._client.user.id).has(permission);
            case 'author':
                return this.channel.permissionsOf(this.author.id).has(permission);
            case 'both':
                return this.hasPermission(permission) && this.hasPermission(permission, 'author');
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

export type ContextDestinations = 'channel' | 'author';
export type PermissionTargets = 'self' | 'author' | 'both';
