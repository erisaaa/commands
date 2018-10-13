import {Command} from '../../';

export default class FakeCommandNoOverview extends Command {
    overview: string;

    async main(ctx) {}
}
