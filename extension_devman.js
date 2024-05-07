const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    console.log('"sss" is now active!');

    let disposable = vscode.commands.registerCommand('sss.generateReports', () => {
        const rulePath = path.join(vscode.workspace.rootPath, '.vscode', 'devman.json');
        const ruleContent = fs.readFileSync(rulePath, 'utf-8');
        const ruleJson = JSON.parse(ruleContent);

        const filesToScan = getFilesToScan(vscode.workspace.rootPath);

        let violations = [];

        filesToScan.forEach(file => {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                for (const keyword of ruleJson.sensitiveKeywords) {
                    if (lines[i].includes(keyword)) {
                        violations.push({ file, lineNumber: i + 1, ruleMatched: keyword });
                    }
                }
            }
        });

        if (violations.length > 0) {
            const resultFolderPath = path.join(vscode.workspace.rootPath, '.vscode', 'result');
            const datetimeSuffix = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
            const resultFolderName = `result-${datetimeSuffix}`;
            const resultFolderFullPath = path.join(resultFolderPath, resultFolderName);

            if (!fs.existsSync(resultFolderPath)) {
                fs.mkdirSync(resultFolderPath);
            }

            fs.mkdirSync(resultFolderFullPath);

            const reportFilePath = path.join(resultFolderFullPath, 'devman_report.json');
            fs.writeFileSync(reportFilePath, JSON.stringify(violations, null, 4));

            vscode.window.showInformationMessage('DevMan scan report generated successfully!');
        } else {
            vscode.window.showInformationMessage('No violations found!');
        }
    });

    context.subscriptions.push(disposable);
}
exports.activate = activate;

function getFilesToScan(rootPath) {
    const excludeFolders = ['node_modules', 'target'];
    const files = [];

    function traverseDirectory(dir) {
        fs.readdirSync(dir).forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                if (!excludeFolders.includes(file)) {
                    traverseDirectory(filePath);
                }
            } else {
                files.push(filePath);
            }
        });
    }

    traverseDirectory(rootPath);
    return files;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};

