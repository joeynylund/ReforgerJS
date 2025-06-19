// log-parser/rjs-logging/regexHandlers/EditorActionEvent.js
const { EventEmitter } = require('events');

class EditorActionEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] EDITOR_ACTION = selectedEntityComponentsNames = ([^,]+), hoveredEntityComponentOwnerId = ([^,]+), selectedEntityComponentsOwnersIds = ([^,]+), action = ([^,]+), hoveredEntityComponentName = ([^,]+), playerName = ([^,]+), playerId = (\d+), playerGUID = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("EDITOR_ACTION =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const selectedEntityComponentsNames = match[2];
            const hoveredEntityComponentOwnerId = parseInt(match[3], 10);
            const selectedEntityComponentsOwnersIds = match[4];
            const action = match[5];
            const hoveredEntityComponentName = match[6];
            const playerName = match[7];
            const playerId = parseInt(match[8], 10);
            const playerGUID = match[9];
            
            const actionType = this.getActionType(action);
            const selectedEntities = this.parseSelectedEntities(selectedEntityComponentsNames, selectedEntityComponentsOwnersIds);
            
            this.emit('editorActionEvent', { 
                timestamp,
                player: {
                    id: playerId,
                    name: playerName,
                    guid: playerGUID
                },
                action: {
                    type: action,
                    category: actionType
                },
                hoveredEntity: {
                    name: hoveredEntityComponentName === 'unknown' ? null : hoveredEntityComponentName,
                    ownerId: hoveredEntityComponentOwnerId === -1 ? null : hoveredEntityComponentOwnerId
                },
                selectedEntities: selectedEntities,
                raw: {
                    timestamp,
                    selectedEntityComponentsNames,
                    hoveredEntityComponentOwnerId,
                    selectedEntityComponentsOwnersIds,
                    action,
                    hoveredEntityComponentName,
                    playerName,
                    playerId,
                    playerGUID
                }
            });
        }
    }

    parseSelectedEntities(namesString, ownersString) {
        if (!namesString || namesString === 'unknown') {
            return [];
        }

        const names = namesString.split(',');
        const owners = ownersString.split(',');
        
        const entities = [];
        for (let i = 0; i < names.length; i++) {
            const name = names[i] ? names[i].trim() : null;
            const ownerId = owners[i] ? parseInt(owners[i].trim(), 10) : null;
            
            entities.push({
                name: name === 'unknown' ? null : name,
                ownerId: ownerId === -1 ? null : ownerId
            });
        }
        
        return entities;
    }

    getActionType(action) {
        if (action.includes('Delete')) {
            return 'Delete';
        } else if (action.includes('Move') || action.includes('Transform')) {
            return 'Transform';
        } else if (action.includes('Create') || action.includes('Place')) {
            return 'Create';
        } else if (action.includes('Edit') || action.includes('Modify')) {
            return 'Edit';
        } else if (action.includes('Select')) {
            return 'Selection';
        } else if (action.includes('Copy') || action.includes('Duplicate')) {
            return 'Copy';
        } else if (action.includes('Paste')) {
            return 'Paste';
        } else if (action.includes('Undo')) {
            return 'Undo';
        } else if (action.includes('Redo')) {
            return 'Redo';
        } else if (action.includes('Context')) {
            return 'Context';
        } else {
            return 'Other';
        }
    }
}

module.exports = EditorActionEventHandler;