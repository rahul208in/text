const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Function to download a file from a URL
async function downloadFile(url, filePath) {
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// Function to copy a file to a destination
function copyFile(source, destination) {
    fs.copyFileSync(source, destination);
}

// Function to download devman.json, docker.json, and ctcrule.json files from different API endpoints
async function downloadFiles() {
    const devmanUrl = 'https://example.com/devman.json';
    const dockerUrl = 'https://example.com/docker.json';
    const ctcruleUrl = 'https://example.com/ctcrule.json';

    const vscodeFolderPath = path.join(__dirname, '.vscode');
    if (!fs.existsSync(vscodeFolderPath)) {
        fs.mkdirSync(vscodeFolderPath);
    }

    const devmanFilePath = path.join(vscodeFolderPath, 'devman.json');
    const dockerFilePath = path.join(vscodeFolderPath, 'docker.json');
    const ctcruleFilePath = path.join(vscodeFolderPath, 'ctcrule.json');

    await downloadFile(devmanUrl, devmanFilePath);
    await downloadFile(dockerUrl, dockerFilePath);
    await downloadFile(ctcruleUrl, ctcruleFilePath);

    console.log('Files downloaded successfully and copied to .vscode folder.');
}

module.exports = {
    downloadFiles
};
