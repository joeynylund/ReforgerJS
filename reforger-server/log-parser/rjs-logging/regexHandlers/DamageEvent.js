const { EventEmitter } = require('events');

class DamageEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] DAMAGE = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("DAMAGE =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const isFriendlyFire = data.isFriendlyFire === 'true';
            const killerId = data.killerId ? parseInt(data.killerId, 10) : null;
            const victimId = data.victimId ? parseInt(data.victimId, 10) : null;
            const distance = data.distance ? parseFloat(data.distance) : null;
            const damageAmount = data.damageAmount ? parseFloat(data.damageAmount) : null;

            this.emit('damageEvent', {
                timestamp,
                damageType: data.damageType,
                victimFaction: data.victimFaction,
                victimId,
                isFriendlyFire,
                weaponName: data.weaponName,
                hitZoneName: data.hitZoneName,
                killerName: data.killerName,
                killerFaction: data.killerFaction,
                distance,
                victimName: data.victimName,
                killerBiId: data.killerBiId,
                damageAmount,
                victimBiId: data.victimBiId,
                killerId,
                raw: {
                    timestamp,
                    damageType: data.damageType,
                    victimFaction: data.victimFaction,
                    victimId,
                    isFriendlyFire,
                    weaponName: data.weaponName,
                    hitZoneName: data.hitZoneName,
                    killerName: data.killerName,
                    killerFaction: data.killerFaction,
                    distance,
                    victimName: data.victimName,
                    killerBiId: data.killerBiId,
                    damageAmount,
                    victimBiId: data.victimBiId,
                    killerId
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
}

module.exports = DamageEventHandler;
