const { EventEmitter } = require('events');

class BaseCaptureEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] BASE_CAPTURE = factionKey = ([^,]+), baseName = ([^,]+), factionName = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("BASE_CAPTURE =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const factionKey = match[2];
            const baseName = match[3];
            const factionName = match[4];
            
            this.emit('baseCaptureEvent', { 
                timestamp,
                factionKey,
                baseName,
                factionName,
                raw: {
                    timestamp,
                    factionKey,
                    baseName,
                    factionName
                }
            });
        }
    }
}

module.exports = BaseCaptureEventHandler;