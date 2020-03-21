import Context from '../Context';

export async function errorHandler(ctx: Context, err: Error, opts: {}) {
    // TODO: properly handle different exceptions
    await ctx.send(`There was an error when trying to run your command:\n${opts.debug ? err.stack : err}`);
    ctx._client.emit('erisa.commands.error', ctx, err);
}
