const { EventEmitter } = require('events');

class GmStatusEventHandler extends EventEmitter {
    constructor() {
        super();
        this.enterRegex = /\[([^\]]+)\] GM_ENTER = (.+)/;
        this.exitRegex = /\[([^\]]+)\] GM_EXIT = (.+)/;
    }

    test(line) {
        return (this.enterRegex.test(line) || this.exitRegex.test(line)) && (line.includes("GM_ENTER =") || line.includes("GM_EXIT ="));
    }

    processLine(line) {
        if (line.includes("GM_ENTER =")) {
            const match = this.enterRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const data = this.parseKeyValuePairs(match[2]);
                const playerId = data.playerId ? parseInt(data.playerId, 10) : null;

                this.emit('gmStatusEvent', {
                    timestamp,
                    status: 'enter',
                    playerBiId: data.playerBiId,
                    playerName: data.playerName,
                    playerId,
                    raw: {
                        timestamp,
                        status: 'enter',
                        playerBiId: data.playerBiId,
                        playerName: data.playerName,
                        playerId
                    }
                });
            }
        } else if (line.includes("GM_EXIT =")) {
            const match = this.exitRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const data = this.parseKeyValuePairs(match[2]);
                const playerId = data.playerId ? parseInt(data.playerId, 10) : null;
                const duration = data.duration ? parseInt(data.duration, 10) : null;

                this.emit('gmStatusEvent', {
                    timestamp,
                    status: 'exit',
                    playerBiId: data.playerBiId,
                    playerName: data.playerName,
                    playerId,
                    duration,
                    raw: {
                        timestamp,
                        status: 'exit',
                        playerBiId: data.playerBiId,
                        playerName: data.playerName,
                        playerId,
                        duration
                    }
                });
            }
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
}

module.exports = GmStatusEventHandler;