const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const FormData = require('form-data');
const { time } = require('console');
const os = rquire('./timer');

function activate(context) {
    console.log('Extension SS activated');
    const ctscanProvider = new ReportProvider('ctscan',600); // 10 minutes
    const hemscanProvider = new ReportProvider('hemscan',1800); // 30 minutes

    vscode.window.createTreeView('reportExplorer', { treeDataProvider: ctscanProvider });
    vscode.window.createTreeView('reportExplorer1', { treeDataProvider: hemscanProvider });

    const refreshCommandCtscan = vscode.commands.registerCommand('extension.refreshCtscanReport', async () => {
        if (ctscanProvider.timer.remainingTime <=0) {
            await runCtscan(ctscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${formatTime}(ctscanProvider.timer.remainingTime) before re-running the scan.`);
           }
    });

    const refreshCommandHemscan = vscode.commands.registerCommand('extension.refreshHemscanReport', async () => {
        if (hemscanProvider.timer.remainingTime <=0) {
            await runHemScan(hemscanProvider);
        } else {
            vscode.window.showWarningMessage(`Please wait for ${formatTime(hemscanProvider.timer.remainingTime)} before re-running the scan.`);
        } 
    });

    context.subscriptions.push(refreshCommandCtscan, refreshCommandHemscan)

    const openReportCommand = vscode.commands.registerCommand('extension.openReport', (resourceUri) => {
        const panel = vscode.window.createWebviewPanel(
            'htmlReport',
            path.basename(resourceUri.path),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(resourceUri.fsPath))] 
            }
        );
        const htmlContent = fs.readFileSync(resourceUri.fsPath, 'utf8');
        panel.webview.html = getWebviewContent(htmlContent);
    });

}

function getWebviewContent(htmlContent){
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report</title>
    </head>
    <body>
        ${htmlContent}
    </body>
    </html>`;
}

async function runCtscan(reportProvider){
    const projectPath = vscode.workspace.rootPath;
    const token = 'YOUR_GENERATED_JWT_TOKEN';
    const homeDir = os.homedir();
    const projectFolderName = path.basename(projctPath);
    const reportDir = path.join(homeDir, '.ss', projectFolderName, 'ctscan');

    fs.ensureDirSync(reportDir);

vscode.window.withProgress({
    location:vscode.ProgressLocation.Notification,
    title: `Running CT Scan`,
    cancellable: false
}, async (progress)=> {
    progress.report({ increment:0, message: "Checking project files..."});

    const filesToCheck = ['package.json', 'pom.xml', 'request.txt'];
    let filePathToSend = null;
    for (const file of filesToCheck) {
        const filePath = path.join(projectPath, file);
        if (fs.existsSync(filePath)) {
            filePathToSend = filePath;
            break;
        }

    }
 
    if (!filePathToSend) {
        vscode.window.showErrorMessage('No Package.json, pom.xml or request.txt found');
        return;
    }

const fileContent = fs.readFileSync(filePathToSend, 'utf8');
const fileType = path.basename(filePathToSend);
const apiEndpoint = 'http://1.2.3.4:8080/validate';

let response;
try {
    vscode.window.showInformationMessage(`Posting ${fileType} to API...`);
    console.log(`Posting ${fileType} to API...`);
    response = await axios.post(apiEndpoint, { content: fileContent}, {
        headers:{
            'accept': '*/*',
            'filetype': fileType,
            'projectType': 'npm',
            'Content-Type': 'application/json'
        }
    });
    vscode.window.showInformationMessage('Received response from API');
    console.log('Received response from API:', response.data);
} catch(error) {
    vscode.window.showErrorMessage(`Failed to post file: ${error.message}`);
    return;
}

if (!response || !response.data){
    vscode.windows.showErrorMessage('Invalid response from API');
    return;
}

const timestamp = new Date().toISOString().replace(/:.]/g, '-');
const jsonFileName = `ctscan-${timestamp}.json`;
const jsonFilePath = path.join(reportDir, jsonFileName);

try {
    vscode.window.showInformationMessage(`Saving JSON response to ${jsonFileName}...`);
    console.log(`Saving JSON response to ${jsonFileName}...`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(response.data, null, 2));
}
catch (error) {
    vscode.window.showErrorMessage(`Failed to save JSON response: ${error.message}`);
    return;
}
let htmlResponse
try {
    vscode.window.showInformationMessage('Posting JSON to another API...');
    console.log('Posting JSON to another API....');
    htmlResponse = await axios.post('http://1.2.3.4'. response.data, {
        headers:{
            'accept': '*/*',
            'filetype': 'json',
            'projectType': 'npm',
            'Content-Type': 'application/json'
        }
    });
    vscode.window.showInformationMessage('Received HTML response from API');
    console.log('Received HTML response from API:', htmlResponse.data);
} catch (error) {
    vscode.window.showErrorMessage(`Failed to get HTML report: ${error.message}`);
    return;
}
if (!htmlResponse || !htmlResponse.data) {
    vscode.window.showErrorMessage('Invalid HTML response from API');
    return;
}
const htmlFileName = `ctscan-${timestamp}.html`;
const htmlFilePath = path.join(reportDir, htmlFileName);

try {
    vscode.window.showInformationMessage(`Saving HTML report to ${htmlFileName}...`);
    console.log(`Saving HTML report to ${htmlFileName}...`);
    fs.writeFileSync(htmlFilePath, htmlResponse.data);
} catch (error) {
    vscode.window.showErrorMessage(`Failed to save HTML report: ${error.message}`);
    return;
}
progress.report({ increment:100, message:"Scan completed. Report Generated"});

vscode.window.showInformationMessage(`Report generated: ${htmlFileName}`);
    console.log('Report generation process finished');

    reportProvider.refresh();
    reportProvider.timer.reset();
    reportProvider.timer.start();
    });

}

async function runHemscan(reportProvider) {
    const projctPath = vscode.workspace.rootPath;
    const token ='mytoken';
    const homeDir = os.homedir();
    const projectFolderName = path.basename(projctPath);
    const reportDir = path.join(homeDir, '.ss', projectFolderName, 'hemscan');


    fs.ensureDirSync(reportDir);

    vscode.window.withProgress({
        location:vscode.ProgressLocation.Notification,
        title: `Running HEM Scan`,
        cancellable: false
    }, async (progress)=> {
        progress.report({ increment:0, message: "Packaging project files..."});

    const zipPath = path.join(projctPath, 'hemscan-project.zip');
    await zipProjectFiles(projectPath, zipPath);

    progress.report({ increment: 50, message: "Sending project files to server..."});

    try {
        const response = await sendHemscanFiles(zipPath, token);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const htmlFileName = `${projectFolderName}-${timestamp}.html`;
        const reportPath = path.join(reportDir, htmlFileName);
        fs.writeFileSync(reportPath, response.data);

        progress.report({ increment: 100, message: "Scan Completed. Report Generated"});
        vscode.window.showInformationMessage(`Scan completed. Report generated: ${htmlFileName}`);

        reportProvider.refresh();
        reportProvider.timer.reset();
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

    return axios.post('https://your-api-endpoint/scan', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
    });
}

class ReportProvider {
    constructor(scanType, timeDuration) {
        this.scanType = scanType;
        this.timeDuration = timeDuration;
        this.timer = new Timer(timeDuration, (remainingTime)=> {

            this.updateTimer(remainingTime);
        }, () => {
            this.timerCompleted();
        });
        this.timer.remainingTime = 0;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.runScanButton = null;
        console.log(`${scanType} ReportProvider initialized`)
    }

    refresh() {
        this._onDidChangeTreeData.fire();
        console.log(`${this.scanType} ReportProvider refreshed`);
    }

    updateTimer(remainingTime) {
        if (this.runScanButton) {
            this.runScanButton.label = `Run ${this.scanType} Scan (Next run in: ${formatTime(remainingTime)})`;
        }
    }

    timerCompleted(){
        if (this.runScanButton) {
            this.runScanButton.label = `Run ${this.scanType} Scan`;
        }
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        const homeDir = os.homedir();
        const projectFolderName = path.basename(vscode.workspace.rootPath);
        const reportDir = path.join(homeDir, '.ss', projectFolderName, this.scanType);
        const files = fs.readdirSync(reportDir).map(file => {
            return new vscode.TreeItem(path.basename(file), vscode.TreeItemCollapsibleState.None);
        });

        if (!this.runScanButton){

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



exports.activate = activate;

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
