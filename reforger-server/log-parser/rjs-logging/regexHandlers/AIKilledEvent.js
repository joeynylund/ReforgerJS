const { EventEmitter } = require('events');

class AIKilledEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] AI_KILLED = grenadeType = ([^,]+), weaponSource = ([^,]+), attachments = ([^,]+), weaponType = ([^,]+), sightName = ([^,]+), isTeamKill = (true|false), killerId = (\d+), killerBiId = ([^,]+), killerFaction = ([^,]+), victimType = ([^,]+), killerName = ([^,]+), weaponName = ([^,]+), killDistance = ([0-9.]+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("AI_KILLED =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const grenadeType = match[2];
            const weaponSource = match[3];
            const attachments = match[4];
            const weaponType = match[5];
            const sightName = match[6];
            const isTeamKill = match[7] === 'true';
            const killerId = parseInt(match[8], 10);
            const killerBiId = match[9];
            const killerFaction = match[10];
            const victimType = match[11];
            const killerName = match[12];
            const weaponName = match[13];
            const killDistance = parseFloat(match[14]);
            
            this.emit('aiKilledEvent', { 
                timestamp,
                grenadeType,
                weaponSource,
                attachments,
                weaponType,
                sightName,
                isTeamKill,
                killerId,
                killerBiId,
                killerFaction,
                victimType,
                killerName,
                weaponName,
                killDistance
            });
        }
    }
}

module.exports = AIKilledEventHandler;