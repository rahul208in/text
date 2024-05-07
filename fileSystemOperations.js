// fileSystemOperations.js
const fs = require('fs');
const path = require('path');

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function writeFile(filePath, data) {
    fs.writeFileSync(filePath, data);
}

function createDirectoryIfNotExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

module.exports = {
    readFile,
    writeFile,
    createDirectoryIfNotExists
};
