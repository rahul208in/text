// extension.js

const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const FormData = require('form-data');
const Timer = require('./timer'); // Import the Timer class

function activate(context) {
    const ctscanProvider = new ReportProvider('ctscan', 600); // 10 minutes
    const hemscanProvider = new ReportProvider('hemscan', 1800); // 30 minutes

    vscode.window.createTreeView('reportExplorer', { treeDataProvider: ctscanProvider });
    vscode.window.createTreeView('reportExplorer1', { treeDataProvider: hemscanProvider });

    const refreshCommandCtscan = vscode.commands.registerCommand('extension.refreshCtscanReport', async () => {
        if (ctscanProvider.timer.remainingTime <= 0) {
            await runScan('ctscan', ctscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${ctscanProvider.timer.remainingTime} seconds before re-running the scan.`);
        }
    });

    const refreshCommandHemscan = vscode.commands.registerCommand('extension.refreshHemscanReport', async () => {
        if (hemscanProvider.timer.remainingTime <= 0) {
            await runScan('hemscan', hemscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${hemscanProvider.timer.remainingTime} seconds before re-running the scan.`);
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

async function runScan(reportType, reportProvider) {
    const projectPath = vscode.workspace.rootPath;
    const token = 'YOUR_GENERATED_JWT_TOKEN';

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Running ${reportType.toUpperCase()} Scan`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "Packaging project files..." });
        
        const zipPath = path.join(projectPath, `${reportType}-project.zip`);
        await zipProjectFiles(projectPath, zipPath);
        
        progress.report({ increment: 50, message: "Sending project files to server..." });
        
        try {
            const response = await sendProjectFiles(zipPath, token);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFolderPath = path.join(projectPath, '.vscode', 'report', reportType);
            if (!fs.existsSync(reportFolderPath)) {
                fs.mkdirpSync(reportFolderPath);
            }

            const htmlFileName = `${reportType}-report-${timestamp}.html`;
            const reportPath = path.join(reportFolderPath, htmlFileName);
            fs.writeFileSync(reportPath, response.data);
            
            progress.report({ increment: 100, message: "Scan completed. Report generated." });
            vscode.window.showInformationMessage(`Scan completed. Report generated: ${htmlFileName}`);
            
            reportProvider.refresh();
            reportProvider.timer.start();
        } catch (error) {
            vscode.window.showErrorMessage(`Scan failed: ${error.message}`);
        }
    });
}

class ReportProvider {
    constructor(reportType, timerDuration) {
        this.reportType = reportType;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.timer = new Timer(timerDuration, this.refresh.bind(this), () => {
            vscode.window.showInformationMessage(`${reportType.toUpperCase()} Scan is ready to be triggered again.`);
            this.refresh();
        });
        this.timer.reset();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const reportFolderPath = path.join(workspacePath, '.vscode', 'report', this.reportType);
        const items = [];

        // Add a "Run Scan" button as the first item
        const runScanButtonLabel = `Run Scan (${this.timer.remainingTime}s)`;
        const runScanButton = new vscode.TreeItem(runScanButtonLabel, vscode.TreeItemCollapsibleState.None);
        runScanButton.command = {
            command: this.reportType === 'ctscan' ? 'extension.refreshCtscanReport' : 'extension.refreshHemscanReport',
            title: 'Run Scan'
        };
        runScanButton.iconPath = {
            light: path.join(__dirname, 'resources', 'icons', 'light', 'run-scan.svg'),
            dark: path.join(__dirname, 'resources', 'icons', 'dark', 'run-scan.svg')
        };
        runScanButton.tooltip = `Click to refresh ${this.reportType} reports`;
        items.push(runScanButton);

        if (fs.existsSync(reportFolderPath)) {
            const files = fs.readdirSync(reportFolderPath).filter(file => file.endsWith('.html'));
            items.push(...files.map(file => new ReportItem(file, reportFolderPath)));
        }

        return items;
    }
}

class ReportItem extends vscode.TreeItem {
    constructor(label, folderPath) {
        super(label);
        this.resourceUri = vscode.Uri.file(path.join(folderPath, label));
        this.command = {
            command: 'extension.openReport',
            title: 'Open Report',
            arguments: [this.resourceUri]
        };
    }
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

async function sendProjectFiles(zipPath, token) {
    const formData = new FormData();
    formData.append('project', fs.createReadStream(zipPath));

    return axios.post('https://your-api-endpoint/scan', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
    });
}

exports.activate = activate;
function deactivate() {}
module.exports = {
    activate,
    deactivate
};
