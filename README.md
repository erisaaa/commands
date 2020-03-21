# Erisa Commands

A robust and customisable command system built for the [Erisa](https://github.com/erisaaa/erisa) framework,
designed to provide an excellent base that covers 95% of needs for bots.

## Installation 
```
npm install @erisa/commands
```

If you haven't already, you'll also need to install [Erisa](https://github.com/erisaaa/erisa).
```
npm install erisa`
```

## Basic Usage
```ts
import {Erisa} from 'erisa';
import commands from '@erisa/commands';

const bot = new Erisa('token');

bot.use(commands(erisa, {
    owner: 'your id',
    prefixes: []
}))
```
