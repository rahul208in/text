// scanningOperations.js
const fs = require('fs');
const vscode = require('vscode');
const path = require('path'); // Import the path module
const { downloadFiles } = require('./fileDownloader');
const { readFile, createDirectoryIfNotExists } = require('./fileSystemOperations');
const { checkDevManViolations } = require('./devManViolations');
const { checkDockerfileViolations } = require('./dockerfileViolations');
const { checkCTCViolations } = require('./ctcViolations');
const { generateReport, generateHtmlReport } = require('./reportGeneration');


async function getFilesToScan(rootPath) {
    const excludeFolders = ['.vscode', 'node_modules', 'target'];
    const files = [];

    async function traverseDirectory(dir) {
        const fileEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        for (const [name, type] of fileEntries) {
            const filePath = path.join(dir, name);
            if (type === vscode.FileType.Directory) {
                if (!excludeFolders.includes(name)) {
                    await traverseDirectory(filePath);
                }
            } else {
                files.push(filePath);
            }
        }
    }

    await traverseDirectory(rootPath);
    return files;
}



async function activate(context) {
    console.log('"sss" is now active!');

    let disposable = vscode.commands.registerCommand('sss.generateReports', async () => {
        try {
            // Download files before running rule validation
            await downloadFiles();

            // Load DevMan rules
            const devmanRulePath = path.join(vscode.workspace.rootPath, '.vscode', 'devman.json');
            const devmanRuleContent = await readFile(devmanRulePath);
            const devmanRuleJson = JSON.parse(devmanRuleContent);

            // Load CTC rules
            const ctcRulePath = path.join(vscode.workspace.rootPath, '.vscode', 'ctcrule.json');
            const ctcRuleContent = await readFile(ctcRulePath);
            const ctcRuleJson = JSON.parse(ctcRuleContent);

            // Load Dockerfile rules
            const ruleFilePath = path.join(vscode.workspace.rootPath, '.vscode', 'docker.json');

            // Load package.json
            const packageJsonPath = path.join(vscode.workspace.rootPath, 'package.json');
            const packageJsonContent = await readFile(packageJsonPath);
            const packageJson = JSON.parse(packageJsonContent);

            const filesToScan = await getFilesToScan(vscode.workspace.rootPath);

            let devmanViolations = [];
            let ctcViolations = [];
            let dockerViolations = [];

            for (const file of filesToScan) {
                const content = await readFile(file);

                // Check for DevMan violations
                if (path.basename(file).toLowerCase() !== 'dockerfile') {
                    // DevMan violations are not checked in Dockerfile
                    devmanViolations = devmanViolations.concat(checkDevManViolations(content, devmanRuleJson, file));
                }

                // Check for CTC violations in package.json
                if (path.basename(file).toLowerCase() === 'package.json') {
                    ctcViolations = ctcViolations.concat(checkCTCViolations(content, ctcRuleJson, file));
                }

                // Check for Dockerfile violations
                if (path.basename(file).toLowerCase() === 'dockerfile') {
                    dockerViolations = dockerViolations.concat(await checkDockerfileViolations(content, ruleFilePath, file));
                }
            }

            // Generate reports and show success message
            const resultFolderPath = path.join(vscode.workspace.rootPath, '.vscode', 'result');
            const datetimeSuffix = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
            const resultFolderName = `result-${datetimeSuffix}`;

            createDirectoryIfNotExists(resultFolderPath);
            const resultFolderFullPath = path.join(resultFolderPath, resultFolderName);
            createDirectoryIfNotExists(resultFolderFullPath);

            const devmanReportFilePath = path.join(resultFolderFullPath, 'devman_report.json');
            const ctcReportFilePath = path.join(resultFolderFullPath, 'ctcscan_report.json');
            const dockerReportFilePath = path.join(resultFolderFullPath, 'docker_scan_report.json');

            await generateReport(devmanViolations, devmanReportFilePath);
            await generateReport(ctcViolations, ctcReportFilePath);
            await generateReport(dockerViolations, dockerReportFilePath);

            // Generate HTML report
            const htmlReportFilePath = path.join(resultFolderFullPath, 'report.html');
            generateHtmlReport(devmanViolations, ctcViolations, dockerViolations, packageJson, datetimeSuffix, htmlReportFilePath);

            vscode.window.showInformationMessage('Scan reports generated successfully!');
        } catch (error) {
            console.error('Error generating reports:', error);
            vscode.window.showErrorMessage('Error generating reports. See the console for more information.');
        }
    });

    context.subscriptions.push(disposable);
}


module.exports = {
    activate,
    getFilesToScan
};
