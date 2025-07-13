const { EventEmitter } = require('events');

class GameStatusEventHandler extends EventEmitter {
    constructor() {
        super();
        this.startRegex = /\[([^\]]+)\] GAME_START = scenarioId = ([^,]+), buildVersion = (.+)/;
        this.endRegex = /\[([^\]]+)\] GAME_END = endReason = ([^,]+), winnerFactionName = ([^,]+), winnerFactionKey = ([^,]+), buildVersion = (.+)/;
    }

    test(line) {
        return (this.startRegex.test(line) || this.endRegex.test(line)) && (line.includes("GAME_START =") || line.includes("GAME_END ="));
    }

    processLine(line) {
        if (line.includes("GAME_START =")) {
            const match = this.startRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const scenarioId = match[2];
                const buildVersion = match[3];
                
                this.emit('gameStatusEvent', { 
                    timestamp,
                    status: 'start',
                    scenarioId,
                    buildVersion,
                    raw: {
                        timestamp,
                        status: 'start',
                        scenarioId,
                        buildVersion
                    }
                });
            }
        } else if (line.includes("GAME_END =")) {
            const match = this.endRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const endReason = match[2];
                const winnerFactionName = match[3];
                const winnerFactionKey = match[4];
                const buildVersion = match[5];
                
                this.emit('gameStatusEvent', { 
                    timestamp,
                    status: 'end',
                    endReason,
                    winnerFactionName,
                    winnerFactionKey,
                    buildVersion,
                    raw: {
                        timestamp,
                        status: 'end',
                        endReason,
                        winnerFactionName,
                        winnerFactionKey,
                        buildVersion
                    }
                });
            }
        }
    }
}

module.exports = GameStatusEventHandler;