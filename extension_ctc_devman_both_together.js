const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    console.log('"sss" is now active!');

    let disposable = vscode.commands.registerCommand('sss.generateReports', () => {
        const devmanRulePath = path.join(vscode.workspace.rootPath, '.vscode', 'devman.json');
        const devmanRuleContent = fs.readFileSync(devmanRulePath, 'utf-8');
        const devmanRuleJson = JSON.parse(devmanRuleContent);

        const ctcRulePath = path.join(vscode.workspace.rootPath, '.vscode', 'ctcrule.json');
        const ctcRuleContent = fs.readFileSync(ctcRulePath, 'utf-8');
        const ctcRuleJson = JSON.parse(ctcRuleContent);

        const packageJsonPath = path.join(vscode.workspace.rootPath, 'package.json');
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        const filesToScan = getFilesToScan(vscode.workspace.rootPath);

        let devmanViolations = [];
        let ctcViolations = [];

        filesToScan.forEach(file => {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');

            // Check for DevMan violations
            for (let i = 0; i < lines.length; i++) {
                for (const keyword of devmanRuleJson.sensitiveKeywords) {
                    const regex = new RegExp(keyword, 'g');
                    if (regex.test(lines[i])) {
                        devmanViolations.push({ file, lineNumber: i + 1, ruleMatched: keyword });
                    }
                }
            }

            // Check for CTC violations (assuming JavaScript project for simplicity)
            ctcViolations = checkDependencies(packageJson, ctcRuleJson.libraries);
        });

        const resultFolderPath = path.join(vscode.workspace.rootPath, '.vscode', 'result');
        const datetimeSuffix = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
        const resultFolderName = `result-${datetimeSuffix}`;

        if (!fs.existsSync(resultFolderPath)) {
            fs.mkdirSync(resultFolderPath);
        }

        const resultFolderFullPath = path.join(resultFolderPath, resultFolderName);
        if (!fs.existsSync(resultFolderFullPath)) {
            fs.mkdirSync(resultFolderFullPath);
        }

        // Generate reports
        const devmanReportFilePath = path.join(resultFolderFullPath, 'devman_report.json');
        const ctcReportFilePath = path.join(resultFolderFullPath, 'ctcscan_report.json');
        generateReport(devmanViolations, devmanReportFilePath);
        generateReport(ctcViolations, ctcReportFilePath);

        // Generate HTML report
        const htmlReportFilePath = path.join(resultFolderFullPath, 'report.html');
        generateHtmlReport(devmanViolations, ctcViolations, packageJson, datetimeSuffix, htmlReportFilePath);

        vscode.window.showInformationMessage('Scan reports generated successfully!');
    });

    context.subscriptions.push(disposable);
}

function getFilesToScan(rootPath) {
    const excludeFolders = ['.vscode', 'node_modules', 'target'];
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

function generateReport(violations, reportFilePath) {
    fs.writeFileSync(reportFilePath, JSON.stringify(violations, null, 4));
}

function generateHtmlReport(devmanViolations, ctcViolations, packageJson, datetimeSuffix, htmlReportFilePath) {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan Report</title>
        </head>
        <body>
            <h1>Safety & Soundness Scan Report</h1>
            <p>Application Name: ${packageJson.name}</p>
            <p>Application Version: ${packageJson.version}</p>
            <p>Scan Date: ${datetimeSuffix}</p>
            <h2>DevMan Violations:</h2>
            <ul>
                ${devmanViolations.map(violation => `<li>File: ${violation.file}, Line: ${violation.lineNumber}, Rule Matched: ${violation.ruleMatched}</li>`).join('')}
            </ul>
            <h2>CTC Violations:</h2>
            <ul>
                ${ctcViolations.map(violation => `<li>Dependency: ${violation.dependency}, Version: ${violation.version}, Status: ${violation.status}</li>`).join('')}
            </ul>
        </body>
        </html>
    `;
    fs.writeFileSync(htmlReportFilePath, htmlContent);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
