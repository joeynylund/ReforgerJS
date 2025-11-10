// log-parser/rjs-logging/regexHandlers/PlayerKilledEvent.js
const { EventEmitter } = require('events');

class PlayerKilledEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] PLAYER_KILLED = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("PLAYER_KILLED =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const isTeamKill = data.isTeamKill === 'true';
            const isFriendlyFire = data.isFriendlyFire === 'true';
            const killerId = data.killerId ? parseInt(data.killerId, 10) : null;
            const victimId = data.victimId ? parseInt(data.victimId, 10) : null;
            const killDistance = data.killDistance ? parseFloat(data.killDistance) : null;

            this.emit('playerKilledEvent', {
                timestamp,
                grenadeType: data.grenadeType,
                victimName: data.victimName,
                attachments: data.attachments ? data.attachments.trim() : '',
                sightName: data.sightName,
                isTeamKill,
                killerId,
                killerBiId: data.killerBiId,
                victimFaction: data.victimFaction,
                killerFaction: data.killerFaction,
                victimId,
                weaponSource: data.weaponSource,
                killerName: data.killerName,
                isFriendlyFire,
                weaponName: data.weaponName,
                weaponType: data.weaponType,
                victimBiId: data.victimBiId,
                killDistance
            });
        }
    }

    parseKeyValuePairs(dataString) {
        const result = {};
        // Match key = value pairs, where value can contain commas or be empty
        const regex = /(\w+)\s*=\s*([^,]*?)(?=\s*,\s*\w+\s*=|$)/g;
        let match;

        while ((match = regex.exec(dataString)) !== null) {
            const key = match[1];
            const value = match[2].trim();
            result[key] = value;
        }

        return result;
    }
}

module.exports = PlayerKilledEventHandler;