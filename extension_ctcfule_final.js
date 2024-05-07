const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    console.log('"sss" is now active!');

    let disposable = vscode.commands.registerCommand('sss.generateReports', () => {
        const projectType = identifyProjectType();

        const rulePath = path.join(vscode.workspace.rootPath, '.vscode', 'ctcrule.json');
        const ruleContent = fs.readFileSync(rulePath, 'utf-8');
        const ruleJson = JSON.parse(ruleContent);

        let violations = [];

        if (projectType === 'JavaScript') {
            const packageJsonPath = path.join(vscode.workspace.rootPath, 'package.json');
            const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);

            violations = checkDependencies(packageJson, ruleJson.libraries);
        } else if (projectType === 'Java') {
            // Add logic for Java project scanning
        }

        if (violations.length > 0) {
            const resultFolderPath = path.join(vscode.workspace.rootPath, '.vscode', 'result');
            const datetimeSuffix = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
            const resultFolderName = `result-${datetimeSuffix}`;
            const resultFolderFullPath = path.join(resultFolderPath, resultFolderName);

            if (!fs.existsSync(resultFolderPath)) {
                fs.mkdirSync(resultFolderPath);
            }

            fs.mkdirSync(resultFolderFullPath);

            const reportFilePath = path.join(resultFolderFullPath, 'ctcscan_report.json');
            fs.writeFileSync(reportFilePath, JSON.stringify(violations, null, 4));

            vscode.window.showInformationMessage('CTC scan report generated successfully!');
        } else {
            vscode.window.showInformationMessage('No violations found!');
        }
    });

    context.subscriptions.push(disposable);
}
exports.activate = activate;

function identifyProjectType() {
    // Add logic to identify project type based on files present
    // For simplicity, let's assume JavaScript for now
    return 'JavaScript';
}

function checkDependencies(packageJson, rules) {
    let violations = [];
    for (const [dependency, version] of Object.entries(packageJson.devDependencies)) {
        const rule = rules.find(r => r.name === dependency && checkVersion(version, r.version));
        if (rule && rule.status !== 'allowed') {
            violations.push({ dependency, version, status: rule.status });
        }
    }
    return violations;
}

function checkVersion(version, ruleVersion) {
    // Add logic to check if version meets the ruleVersion
    // For simplicity, let's assume version check is successful
    return true;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
