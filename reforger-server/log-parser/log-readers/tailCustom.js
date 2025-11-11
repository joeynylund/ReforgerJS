const fs = require('fs');
const path = require('path');

class TailCustomReader {
  constructor(queueLine, options = {}) {
    if (!options.logDir) {
      throw new Error('logDir must be specified in options.');
    }
    if (!options.filename) {
      throw new Error('filename must be specified in options.');
    }
    if (typeof queueLine !== 'function') {
      throw new Error('queueLine must be specified and be a function.');
    }
    
    this.queueLine = queueLine;
    this.options = options;
    this.logDir = options.logDir;
    this.filename = options.filename;
    this.scanInterval = options.scanInterval || 3000;
    this.stateSaveInterval = options.stateSaveInterval || 60000;
    
    const parserType = options.parserName || 'custom';
    this.stateFile = path.resolve(__dirname, `${parserType}_state.json`);
    
    this.filePath = path.join(this.logDir, this.filename);
    
    this.lastFileSize = 0;
    this.buffer = ''; // Buffer for incomplete lines
    this.scanIntervalID = null;
    this.stateSaveID = null;
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf-8');
        if (data && data.trim()) {
          const state = JSON.parse(data);
          this.lastFileSize = state.lastFileSize || 0;
          this.buffer = state.buffer || '';
        }
      }
    } catch (error) {
      logger.warn(`Error loading state for custom parser: ${error.message}`);
      this.lastFileSize = 0;
      this.buffer = '';
    }
  }

  saveState() {
    try {
      const state = {
        filePath: this.filePath,
        lastFileSize: this.lastFileSize,
        buffer: this.buffer || ''
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      logger.warn(`Error saving state for custom parser: ${error.message}`);
    }
  }

  checkFileExists() {
    try {
      if (fs.existsSync(this.filePath)) {
        return true;
      }
      logger.warn(`Custom log file not found: ${this.filePath}, but will continue monitoring for it`);
      return false;
    } catch (error) {
      logger.error(`Error checking log file existence: ${error.message}`);
      return false;
    }
  }

  scanLogs() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      
      const stats = fs.statSync(this.filePath);
      const newSize = stats.size;
      
      if (newSize < this.lastFileSize) {
        logger.info(`File ${this.filePath} appears to have been truncated or rotated. Resetting position.`);
        this.lastFileSize = 0;
        this.buffer = '';
      }
      
      if (newSize > this.lastFileSize) {
        // Read only the new portion of the file
        const fd = fs.openSync(this.filePath, 'r');
        const chunkSize = 64 * 1024; // 64KB chunks
        let currentPos = this.lastFileSize;
        let buffer = this.buffer || '';
        
        try {
          while (currentPos < newSize) {
            const readSize = Math.min(chunkSize, newSize - currentPos);
            const chunk = Buffer.alloc(readSize);
            const bytesRead = fs.readSync(fd, chunk, 0, readSize, currentPos);
            
            if (bytesRead === 0) break;
            
            const chunkStr = chunk.toString('utf8', 0, bytesRead);
            const allData = buffer + chunkStr;
            const lines = allData.split(/\r?\n/);
            
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';
            
            // Process complete lines immediately
            for (const line of lines) {
              if (line.trim().length > 0) {
                this.queueLine(line.trim());
              }
            }
            
            currentPos += bytesRead;
            
            // Prevent blocking by processing in smaller increments
            if (currentPos < newSize && (currentPos - this.lastFileSize) > chunkSize * 10) {
              // Save progress and continue on next scan
              this.buffer = buffer;
              this.lastFileSize = currentPos;
              fs.closeSync(fd);
              return;
            }
          }
          
          // Process any remaining buffer
          if (buffer && buffer.trim().length > 0) {
            this.queueLine(buffer.trim());
            buffer = '';
          }
          
          this.buffer = buffer;
          this.lastFileSize = newSize;
          fs.closeSync(fd);
        } catch (readErr) {
          fs.closeSync(fd);
          throw readErr;
        }
      }
    } catch (err) {
      logger.error(`Error scanning logs: ${err.message}`);
    }
  }

  watch() {
    this.loadState();
    this.checkFileExists();
    
    this.scanIntervalID = setInterval(() => {
      this.scanLogs();
    }, this.scanInterval);

    this.stateSaveID = setInterval(() => {
      this.saveState();
    }, this.stateSaveInterval);

    logger.info(`Started watching custom log file (will wait for it if not found): ${this.filePath}`);
    return Promise.resolve(); 
  }

  async unwatch() {
    if (this.scanIntervalID) {
      clearInterval(this.scanIntervalID);
      this.scanIntervalID = null;
    }
    if (this.stateSaveID) {
      clearInterval(this.stateSaveID);
      this.stateSaveID = null;
    }
    this.saveState();
    return Promise.resolve();
  }
}

module.exports = TailCustomReader;