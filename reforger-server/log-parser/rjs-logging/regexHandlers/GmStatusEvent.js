const { EventEmitter } = require('events');

class GmStatusEventHandler extends EventEmitter {
    constructor() {
        super();
        this.enterRegex = /\[([^\]]+)\] GM_ENTER = playerBiId = ([^,]+), playerName = ([^,]+), playerId = (\d+)/;
        this.exitRegex = /\[([^\]]+)\] GM_EXIT = playerBiId = ([^,]+), playerName = ([^,]+), playerId = (\d+), duration = (\d+)/;
    }

    test(line) {
        return (this.enterRegex.test(line) || this.exitRegex.test(line)) && (line.includes("GM_ENTER =") || line.includes("GM_EXIT ="));
    }

    processLine(line) {
        if (line.includes("GM_ENTER =")) {
            const match = this.enterRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const playerBiId = match[2];
                const playerName = match[3];
                const playerId = parseInt(match[4], 10);
                
                this.emit('gmStatusEvent', { 
                    timestamp,
                    status: 'enter',
                    playerBiId,
                    playerName,
                    playerId,
                    raw: {
                        timestamp,
                        status: 'enter',
                        playerBiId,
                        playerName,
                        playerId
                    }
                });
            }
        } else if (line.includes("GM_EXIT =")) {
            const match = this.exitRegex.exec(line);
            if (match) {
                const timestamp = match[1];
                const playerBiId = match[2];
                const playerName = match[3];
                const playerId = parseInt(match[4], 10);
                const duration = parseInt(match[5], 10);
                
                this.emit('gmStatusEvent', { 
                    timestamp,
                    status: 'exit',
                    playerBiId,
                    playerName,
                    playerId,
                    duration,
                    raw: {
                        timestamp,
                        status: 'exit',
                        playerBiId,
                        playerName,
                        playerId,
                        duration
                    }
                });
            }
        }
    }
}

module.exports = GmStatusEventHandler;