const { EventEmitter } = require('events');

class AIKilledEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] AI_KILLED = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("AI_KILLED =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const isTeamKill = data.isTeamKill === 'true';
            const killerId = data.killerId ? parseInt(data.killerId, 10) : null;
            const killDistance = data.killDistance ? parseFloat(data.killDistance) : null;

            this.emit('aiKilledEvent', {
                timestamp,
                grenadeType: data.grenadeType,
                weaponSource: data.weaponSource,
                attachments: data.attachments,
                weaponType: data.weaponType,
                sightName: data.sightName,
                isTeamKill,
                killerId,
                killerBiId: data.killerBiId,
                killerFaction: data.killerFaction,
                victimType: data.victimType,
                killerName: data.killerName,
                weaponName: data.weaponName,
                killDistance
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
}

module.exports = AIKilledEventHandler;