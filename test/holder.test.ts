/* tslint:disable no-unused-expression */

import 'mocha';
import Eris from 'eris';
import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {Erisa} from 'erisa';
import commands, {Holder} from '..';
import * as fakeCmds from './commands';

chai.use(chaiAsPromised);

const normalAttach = (c: Erisa) => c.usePairsArray(commands(c, {owner: 'foo', prefixes: ['!', '?', /^foo (.+)/]}));
let client = new Erisa('nothing');
let commandsExt: Holder = client.extensions.commands;

beforeEach(() => {
    // Reset client for each test.
    client = new Erisa('nothing');
    normalAttach(client);
    commandsExt = client.extensions.commands;
});

describe('Holder', () => {
    describe('#testPrefix', () => {
        it("shouldn't match the provided string", () => {
            expect(commandsExt.testPrefix('foo')[0]).to.be.false;
            expect(commandsExt.testPrefix('foobar')[0]).to.be.false;
            expect(commandsExt.testPrefix('foo!')[0]).to.be.false;
            expect(commandsExt.testPrefix('foo?')[0]).to.be.false;
        });

        it('should match the provided string', () => {
            expect(commandsExt.testPrefix('foo bar')[0]).to.be.true;
            expect(commandsExt.testPrefix('!foo')[0]).to.be.true;
            expect(commandsExt.testPrefix('?foo')[0]).to.be.true;
            expect(commandsExt.testPrefix('!foo bar some other stuff')[0]).to.be.true;
            expect(commandsExt.testPrefix('?foo bar some other stuff')[0]).to.be.true;
        });

        it('should return the string without the prefix', () => {
            expect(commandsExt.testPrefix('foo bar')[1]).to.equal('bar');
            expect(commandsExt.testPrefix('!foo')[1]).to.equal('foo');
            expect(commandsExt.testPrefix('?foo')[1]).to.equal('foo');
            expect(commandsExt.testPrefix('!foo bar some other stuff')[1]).to.equal('foo bar some other stuff');
            expect(commandsExt.testPrefix('?foo bar some other stuff')[1]).to.equal('foo bar some other stuff');
        });
    });

    describe('#add', () => {

    });
});
