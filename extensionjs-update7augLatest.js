// extension.js

const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');
const os = require('os');
const Timer = require('./timer'); // Import the Timer class

function activate(context) {
    const ctscanProvider = new ReportProvider('ctscan', 600); // 10 minutes timer
    const hemscanProvider = new ReportProvider('hemscan', 1800); // 30 minutes timer

    vscode.window.createTreeView('reportExplorer', { treeDataProvider: ctscanProvider });
    vscode.window.createTreeView('reportExplorer1', { treeDataProvider: hemscanProvider });

    const refreshCommandCtscan = vscode.commands.registerCommand('extension.refreshCtscanReport', async () => {
        if (ctscanProvider.timer.remainingTime <= 0) {
            await generateReport(ctscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${formatTime(ctscanProvider.timer.remainingTime)} before re-running the scan.`);
        }
    });

    const refreshCommandHemscan = vscode.commands.registerCommand('extension.refreshHemscanReport', async () => {
        if (hemscanProvider.timer.remainingTime <= 0) {
            await runHemscan(hemscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${formatTime(hemscanProvider.timer.remainingTime)} before re-running the scan.`);
        }
    });

    context.subscriptions.push(refreshCommandCtscan, refreshCommandHemscan);

    const openReportCommand = vscode.commands.registerCommand('extension.openReport', (resourceUri) => {
        const panel = vscode.window.createWebviewPanel(
            'htmlReport',
            path.basename(resourceUri.path),
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = fs.readFileSync(resourceUri.fsPath, 'utf8');
    });

    context.subscriptions.push(openReportCommand);

    console.log('Extension activated and commands registered.');
}

async function generateReport(reportProvider) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const filesToCheck = ['package.json', 'pom.xml', 'request.txt'];

    let filePathToSend = null;
    for (const file of filesToCheck) {
        const filePath = path.join(workspacePath, file);
        if (fs.existsSync(filePath)) {
            filePathToSend = filePath;
            break;
        }
    }

    if (!filePathToSend) {
        throw new Error('No package.json, pom.xml, or request.txt found in the workspace');
    }

    const fileContent = fs.readFileSync(filePathToSend, 'utf8');
    const fileType = path.basename(filePathToSend);
    const apiEndpoint = 'http://1.2.3.4/postpackage'; // Replace with the correct endpoint

    let response;
    try {
        vscode.window.showInformationMessage(`Posting ${fileType} to API...`);
        console.log(`Posting ${fileType} to API...`);
        response = await axios.post(apiEndpoint, { content: fileContent }, {
            headers: {
                'accept': '*/*',
                'filetype': fileType,
                'projectType': 'npm'
            }
        });
        vscode.window.showInformationMessage('Received response from API.');
        console.log('Received response from API:', response.data);
    } catch (error) {
        throw new Error(`Failed to post file: ${error.message}`);
    }

    if (!response || !response.data) {
        throw new Error('Invalid response from API');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFileName = `ctscan-${timestamp}.json`;
    const jsonFilePath = path.join(workspacePath, '.ss', 'ctscan', jsonFileName);

    if (!fs.existsSync(path.dirname(jsonFilePath))) {
        fs.mkdirSync(path.dirname(jsonFilePath), { recursive: true });
    }

    vscode.window.showInformationMessage(`Saving JSON response to ${jsonFileName}...`);
    console.log(`Saving JSON response to ${jsonFileName}...`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(response.data, null, 2));

    let htmlResponse;
    try {
        vscode.window.showInformationMessage('Posting JSON to another API...');
        console.log('Posting JSON to another API...');
        htmlResponse = await axios.post('http://another-api-endpoint', response.data, {
            headers: {
                'accept': '*/*',
                'filetype': 'json',
                'projectType': 'npm'
            }
        });
        vscode.window.showInformationMessage('Received HTML response from API.');
        console.log('Received HTML response from API:', htmlResponse.data);
    } catch (error) {
        throw new Error(`Failed to get HTML report: ${error.message}`);
    }

    if (!htmlResponse || !htmlResponse.data) {
        throw new Error('Invalid HTML response from API');
    }

    const htmlFileName = `ctscan-${timestamp}.html`;
    const htmlFilePath = path.join(workspacePath, '.ss', 'ctscan', htmlFileName);

    vscode.window.showInformationMessage(`Saving HTML report to ${htmlFileName}...`);
    console.log(`Saving HTML report to ${htmlFileName}...`);
    fs.writeFileSync(htmlFilePath, htmlResponse.data);

    // Refresh the tree view to show the updated report
    reportProvider.refresh();
    vscode.window.showInformationMessage('Report generation process finished.');
    console.log('Report generation process finished.');
}

async function runHemscan(reportProvider) {
    const projectPath = vscode.workspace.rootPath;
    const token = 'YOUR_GENERATED_JWT_TOKEN'; // Replace with your generated JWT token
    const homeDir = os.homedir();
    const projectFolderName = path.basename(projectPath);
    const reportDir = path.join(homeDir, '.ss', projectFolderName, 'hemscan');

    if (!fs.existsSync(reportDir)) {
        fs.mkdirpSync(reportDir);
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Running HEM Scan`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "Packaging project files..." });

        const zipPath = path.join(projectPath, 'hemscan-project.zip');
        await zipProjectFiles(projectPath, zipPath);

        progress.report({ increment: 50, message: "Sending project files to server..." });

        try {
            const response = await sendHemscanFiles(zipPath, token);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const htmlFileName = `${projectFolderName}-${timestamp}.html`;
            const reportPath = path.join(reportDir, htmlFileName);
            fs.writeFileSync(reportPath, response.data);

            progress.report({ increment: 100, message: "Scan completed. Report generated." });
            vscode.window.showInformationMessage(`Scan completed. Report generated: ${htmlFileName}`);

            await pushReportToSS(reportPath, token);
            reportProvider.refresh();
            reportProvider.timer.start();
        } catch (error) {
            vscode.window.showErrorMessage(`Scan failed: ${error.message}`);
        }
    });
}

async function zipProjectFiles(sourceDir, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

        // Add files to the archive, excluding specified folders
        archive.glob('**/*', {
            cwd: sourceDir,
            ignore: ['node_modules/**', 'target/**', 'build/**', '__pycache__/**']
        });

        archive.finalize();
    });
}

async function sendHemscanFiles(zipPath, token) {
    const formData = new FormData();
    formData.append('project', fs.createReadStream(zipPath));

    return axios.post('https://your-hemscan-api-endpoint/scan', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
    });
}

async function pushReportToSS(reportPath, token) {
    const formData = new FormData();
    formData.append('report', fs.createReadStream(reportPath));

    return axios.post('http://localhost:3000/ui', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    });
}

class ReportProvider {
    constructor(scanType, timerDuration) {
        this.scanType = scanType;
        this.timer = new Timer(timerDuration, (remainingTime) => {
            this.updateTimer(remainingTime);
        }, () => {
            this.timerCompleted();
        });
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.runScanButton = null;
        console.log(`${scanType} ReportProvider initialized.`);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
        console.log(`${this.scanType} ReportProvider refreshed.`);
    }

    updateTimer(remainingTime) {
        if (this.runScanButton) {
            this.runScanButton.label = `Run ${this.scanType} Scan (Next run in: ${formatTime(remainingTime)})`;
        }
    }

    timerCompleted() {
        if (this.runScanButton) {
            this.runScanButton.label = `Run ${this.scanType} Scan`;
        }
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const homeDir = os.homedir();
        const projectFolderName = path.basename(vscode.workspace.rootPath);
        const reportDir = path.join(homeDir, '.ss', projectFolderName, this.scanType);
        const files = fs.readdirSync(reportDir).map(file => {
            return new vscode.TreeItem(path.basename(file), vscode.TreeItemCollapsibleState.None);
        });
        if (!this.runScanButton) {
            this.runScanButton = new vscode.TreeItem(
                `Run ${this.scanType} Scan`,
                vscode.TreeItemCollapsibleState.None
            );
            this.runScanButton.command = {
                command: `extension.refresh${this.scanType.charAt(0).toUpperCase() + this.scanType.slice(1)}Report`,
                title: `Run ${this.scanType} Scan`
            };
        }
        return [...files, this.runScanButton];
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return `${minutes}m ${seconds}s`;
}

module.exports = {
    activate
};
