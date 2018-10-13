import {Command} from '../../';

export default class FakeCommandNoMain extends Command {
    overview: string;
    public async main(): Promise<void>;
}
