const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const FormData = require('form-data');

const token = 'YOUR_GENERATED_JWT_TOKEN'; // Replace with the generated JWT token

function activate(context) {
    const reportProvider = new ReportProvider('ctscan');
    const reportProvider1 = new ReportProvider('hemscan');

    vscode.window.createTreeView('reportExplorer', { treeDataProvider: reportProvider });
    vscode.window.createTreeView('reportExplorer1', { treeDataProvider: reportProvider1 });

    const refreshCommand = vscode.commands.registerCommand('extension.refreshReport', async () => {
        await runScan('ctscan', reportProvider);
    });

    const refreshCommand1 = vscode.commands.registerCommand('extension.refreshReport1', async () => {
        await runScan('hemscan', reportProvider1);
    });

    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(refreshCommand1);

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

    console.log('Commands registered and ready.');
}

async function runScan(folderName, reportProvider) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = `Generating Report for ${folderName}`;
    statusBar.show();

    try {
        vscode.window.showInformationMessage(`Starting report generation for ${folderName}...`);
        const projectPath = vscode.workspace.rootPath;
        const zipPath = path.join(projectPath, 'project.zip');
        await zipProjectFiles(projectPath, zipPath);

        const response = await sendProjectFiles(zipPath, token);
        const reportPath = path.join(projectPath, '.vscode', folderName, 'scan-report.html');
        fs.ensureDirSync(path.dirname(reportPath));
        fs.writeFileSync(reportPath, response.data);

        vscode.window.showInformationMessage(`Scan completed. Report generated for ${folderName}.`);
        reportProvider.refresh();

        const openPath = vscode.Uri.file(reportPath);
        vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Scan failed for ${folderName}: ${error.message}`);
    } finally {
        statusBar.hide();
    }
}

async function zipProjectFiles(sourceDir, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

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

class ReportProvider {
    constructor(folderName) {
        this.folderName = folderName;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
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
        const reportFolderPath = path.join(workspacePath, '.vscode', this.folderName);
        const items = [];

        const runScanButton = new vscode.TreeItem(`Run Scan (${this.folderName})`, vscode.TreeItemCollapsibleState.None);
        runScanButton.command = { command: `extension.refreshReport${this.folderName === 'hemscan' ? '1' : ''}`, title: `Run Scan (${this.folderName})` };
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

exports.activate = activate;

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
