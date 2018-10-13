import {Command} from '../../';

export default class FakeCommand extends Command {
    overview: string = 'Foo bar.';

    async main(ctx) {}
}
