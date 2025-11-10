// log-parser/rjs-logging/regexHandlers/ChatMessageEvent.js
const { EventEmitter } = require('events');

class ChatMessageEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] CHAT = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("CHAT =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const playerId = data.playerId ? parseInt(data.playerId, 10) : null;
            const channelId = data.channelId ? parseInt(data.channelId, 10) : null;
            const channelType = this.getChannelType(channelId);

            this.emit('chatMessageEvent', {
                timestamp,
                playerId,
                playerName: data.playerName,
                playerBiId: data.playerBiId,
                channelId,
                channelType,
                message: data.message,
                raw: {
                    timestamp,
                    playerBiId: data.playerBiId,
                    channelId,
                    message: data.message,
                    playerName: data.playerName,
                    playerId
                }
            });
        }
    }

    parseKeyValuePairs(dataString) {
        const result = {};
        // Match key = value pairs, where value can contain commas
        const regex = /(\w+)\s*=\s*([^,]+?)(?=\s*,\s*\w+\s*=|$)/g;
        let match;

        while ((match = regex.exec(dataString)) !== null) {
            const key = match[1];
            const value = match[2].trim();
            result[key] = value;
        }

        return result;
    }

    getChannelType(channelId) {
        switch(channelId) {
            case 0: return 'Global';
            case 1: return 'Faction';
            case 2: return 'Group';
            case 3: return 'Vehicle';
            case 4: return 'Local';
            default: return 'Unknown';
        }
    }
}

module.exports = ChatMessageEventHandler;