export function mockMessageD(content, mID, uID, cID) {
    return {
        id: mID,
        timestamp: new Date().toString(),
        channel_id: cID,
        author: {
            id: uID,
            discriminator: '0000',
            name: 'foo'
        },
        content,
        mentions: []
    };
}
