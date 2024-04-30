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

        const ruleFilePath = path.join(vscode.workspace.rootPath, '.vscode', 'docker.json');

        const filesToScan = getFilesToScan(vscode.workspace.rootPath);

        let devmanViolations = [];
        let ctcViolations = [];
        let dockerViolations = [];

        filesToScan.forEach(file => {
            const content = fs.readFileSync(file, 'utf-8');

            // Check for DevMan violations
            devmanViolations = devmanViolations.concat(checkDevManViolations(content, devmanRuleJson, file));

            // Check for CTC violations
            if (path.basename(file) === 'package.json') {
                ctcViolations = ctcViolations.concat(checkCTCViolations(content, ctcRuleJson, file));
            }
            
            // Check for Dockerfile violations
            if (path.basename(file).toLowerCase() === 'dockerfile') {
                dockerViolations = dockerViolations.concat(checkDockerfileViolations(content, ruleFilePath, file));
            }
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
        const dockerReportFilePath = path.join(resultFolderFullPath, 'docker_scan_report.json');

        generateReport(devmanViolations, devmanReportFilePath);
        generateReport(ctcViolations, ctcReportFilePath);
        generateReport(dockerViolations, dockerReportFilePath);

        // Generate HTML report
        const htmlReportFilePath = path.join(resultFolderFullPath, 'report.html');
        generateHtmlReport(devmanViolations, ctcViolations, dockerViolations, packageJson, datetimeSuffix, htmlReportFilePath);

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

function checkDevManViolations(content, devmanRuleJson, filePath) {
    const lines = content.split('\n');
    let violations = [];

    for (let i = 0; i < lines.length; i++) {
        for (const keyword of devmanRuleJson.sensitiveKeywords) {
            const regex = new RegExp(keyword, 'g');
            if (regex.test(lines[i])) {
                violations.push({ file: filePath, lineNumber: i + 1, ruleMatched: keyword });
            }
        }
    }

    return violations;
}

function checkCTCViolations(content, ctcRuleJson, packageJsonPath) {
    const packageJson = JSON.parse(content);
    let violations = [];

    const lines = content.split('\n');
    
    for (const [dependency, version] of Object.entries(packageJson.devDependencies)) {
        const rule = ctcRuleJson.libraries.find(r => r.name === dependency && checkVersion(version, r.version));
        if (rule && rule.status !== 'allowed') {
            const dependencyLine = lines.findIndex(line => line.includes(`"${dependency}"`));
            violations.push({ dependency, version, status: rule.status, file: packageJsonPath, lineNumber: dependencyLine !== -1 ? dependencyLine + 1 : null });
        }
    }

    return violations;
}



function checkVersion(version, ruleVersion) {
    // Add logic to check if version meets the ruleVersion
    // For simplicity, let's assume version check is successful
    return true;
}

function checkDockerfileViolations(content, ruleFilePath, filePath) {
    const dockerfileViolations = [];
    const lines = content.split('\n');
    const dockerRules = JSON.parse(fs.readFileSync(ruleFilePath, 'utf-8')).rules;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('FROM')) {
            if (line.includes('latest')) {
                dockerfileViolations.push({ violation: dockerRules.FROMImageVersion.description, file: filePath, lineNumber: i + 1 });
            }
        } else if (line.startsWith('USER')) {
            if (line.includes('root')) {
                dockerfileViolations.push({ violation: dockerRules.ContainerUser.description, file: filePath, lineNumber: i + 1 });
            }
        }
    }

    return dockerfileViolations;
}

function generateReport(violations, reportFilePath) {
    fs.writeFileSync(reportFilePath, JSON.stringify(violations, null, 4));
}

function generateHtmlReport(devmanViolations, ctcViolations, dockerViolations, packageJson, datetimeSuffix, htmlReportFilePath) {
    const devmanHtml = generateViolationTable(devmanViolations, 'DevMan Violations');
    const ctcHtml = generateViolationTable(ctcViolations, 'CTC Violations');
    const dockerHtml = generateViolationTable(dockerViolations, 'Dockerfile Violations');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan Report</title>
            <style>
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                th, td {
                    border: 1px solid #dddddd;
                    text-align: left;
                    padding: 8px;
                }
                th {
                    background-color: #f2f2f2;
                }
            </style>
        </head>
        <body>
            <h1>Scan Report</h1>
            <p>Application Name: ${packageJson.name}</p>
            <p>Application Version: ${packageJson.version}</p>
            <p>Scan Date: ${datetimeSuffix}</p>
            ${devmanHtml}
            ${ctcHtml}
            ${dockerHtml}
        </body>
        </html>
    `;
    fs.writeFileSync(htmlReportFilePath, htmlContent);
}

function generateViolationTable(violations, title) {
    if (violations.length === 0) {
        return '';
    }

    let html = `
        <h2>${title}:</h2>
        <table>
            <tr>
                <th>File</th>
                <th>Line Number</th>
                <th>Violation</th>
                <th>Status</th>
            </tr>
    `;
    violations.forEach(violation => {
        const lineNumber = violation.lineNumber !== -1 ? violation.lineNumber : '-';
        html += `
            <tr>
                <td>${violation.file || ''}</td>
                <td>${lineNumber}</td>
                <td>${violation.ruleMatched || violation.dependency || violation.violation}</td>
                <td>${violation.status || ''}</td>
            </tr>
        `;
    });
    html += `</table>`;
    return html;
}


function deactivate() {}

module.exports = {
    activate,
    deactivate
};
