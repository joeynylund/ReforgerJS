const { EventEmitter } = require('events');

class GameStatusEventHandler extends EventEmitter {
    constructor() {
        super();
        this.startRegex = /\[([^\]]+)\] GAME_START = (.+)/;
        this.endRegex = /\[([^\]]+)\] GAME_END = (.+)/;
    }

    test(line) {
        return (this.startRegex.test(line) || this.endRegex.test(line)) && (line.includes("GAME_START =") || line.includes("GAME_END ="));
    }

    processLine(line) {
        if (line.includes("GAME_START =")) {
            const match = this.startRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const data = this.parseKeyValuePairs(match[2]);

                this.emit('gameStatusEvent', {
                    timestamp,
                    status: 'start',
                    scenarioId: data.scenarioId,
                    buildVersion: data.buildVersion,
                    raw: {
                        timestamp,
                        status: 'start',
                        scenarioId: data.scenarioId,
                        buildVersion: data.buildVersion
                    }
                });
            }
        } else if (line.includes("GAME_END =")) {
            const match = this.endRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const data = this.parseKeyValuePairs(match[2]);

                this.emit('gameStatusEvent', {
                    timestamp,
                    status: 'end',
                    endReason: data.endReason,
                    winnerFactionName: data.winnerFactionName,
                    winnerFactionKey: data.winnerFactionKey,
                    buildVersion: data.buildVersion,
                    raw: {
                        timestamp,
                        status: 'end',
                        endReason: data.endReason,
                        winnerFactionName: data.winnerFactionName,
                        winnerFactionKey: data.winnerFactionKey,
                        buildVersion: data.buildVersion
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

module.exports = GameStatusEventHandler;