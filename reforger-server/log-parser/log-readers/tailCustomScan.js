const fs = require('fs');
const path = require('path');

class TailCustomScanReader {
  constructor(queueData, options = {}) {
    if (!options.logDir) {
      throw new Error('logDir must be specified in options.');
    }
    if (!options.filename) {
      throw new Error('filename must be specified in options.');
    }
    if (typeof queueData !== 'function') {
      throw new Error('queueData must be specified and be a function.');
    }
    
    this.queueData = queueData;
    this.options = options;
    this.logDir = options.logDir;
    this.filename = options.filename;
    this.scanInterval = options.scanInterval || 60000;
    
    this.filePath = path.join(this.logDir, this.filename);
    
    this.scanIntervalID = null;
    this.lastFileContent = null;
    this.lastModifiedTime = null;
  }

  checkFileExists() {
    try {
      if (fs.existsSync(this.filePath)) {
        return true;
      }
      logger.warn(`JSON file not found: ${this.filePath}, but will continue monitoring for it`);
      return false;
    } catch (error) {
      logger.error(`Error checking JSON file existence: ${error.message}`);
      return false;
    }
  }

  scanFile() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      
      // Always read the file content on each scan interval
      // This ensures we catch all changes even if file size/modification time doesn't change
      const fileContent = fs.readFileSync(this.filePath, 'utf-8');
      
      try {
        const jsonData = JSON.parse(fileContent);
        // Always emit the data, regardless of whether content changed
        // This is important for plugins that track time-based metrics
        this.queueData(jsonData);
        this.lastFileContent = fileContent;
        
        const stats = fs.statSync(this.filePath);
        this.lastModifiedTime = stats.mtime.getTime();
      } catch (parseError) {
        logger.error(`Error parsing JSON file ${this.filePath}: ${parseError.message}`);
      }
      
    } catch (err) {
      logger.error(`Error scanning JSON file: ${err.message}`);
    }
  }

  watch() {
    this.checkFileExists();
    
    this.scanFile();
    
    this.scanIntervalID = setInterval(() => {
      this.scanFile();
    }, this.scanInterval);

    logger.info(`Started scanning JSON file (interval: ${this.scanInterval}ms): ${this.filePath}`);
    return Promise.resolve(); 
  }

  async unwatch() {
    if (this.scanIntervalID) {
      clearInterval(this.scanIntervalID);
      this.scanIntervalID = null;
    }
    return Promise.resolve();
  }
}

module.exports = TailCustomScanReader;