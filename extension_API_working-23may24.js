const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

let diagnosticCollection;
let decorationType;
let lastReportContent = '';

// Function to fetch docker rules from the API and save to docker.json
async function fetchDockerRules() {
    try {
        const response = await axios.get('http://localhost:3000/getDockerRule');
        const rules = response.data;
        const vscodePath = vscode.workspace.rootPath;
        const dockerJsonPath = path.join(vscodePath, '.vscode', 'docker.json');

        fs.writeFileSync(dockerJsonPath, JSON.stringify(rules, null, 4));
        vscode.window.showInformationMessage('Docker rules fetched and saved to docker.json');
        return rules;
    } catch (error) {
        vscode.window.showErrorMessage('Error fetching docker rules: ' + error.message);
        return null;
    }
}

// Function to read docker.json file
function readDockerJson() {
    const vscodePath = vscode.workspace.rootPath;
    const dockerJsonPath = path.join(vscodePath, '.vscode', 'docker.json');

    try {
        const dockerJson = fs.readFileSync(dockerJsonPath, 'utf8');
        return JSON.parse(dockerJson);
    } catch (error) {
        vscode.window.showErrorMessage('Error reading docker.json file: ' + error.message);
        return null;
    }
}

// Function to find Dockerfile in the project
function findDockerfile() {
    const vscodePath = vscode.workspace.rootPath;
    const dockerfilePath = path.join(vscodePath, 'Dockerfile');
    
    if (fs.existsSync(dockerfilePath)) {
        return dockerfilePath;
    } else {
        vscode.window.showErrorMessage('Dockerfile not found in the project');
        return null;
    }
}

// Function to validate Dockerfile against rules from API
async function validateDockerfile(dockerfilePath) {
    try {
        const dockerfileContents = fs.readFileSync(dockerfilePath, 'utf8');
        const response = await axios.post('http://localhost:3000/validateDockerfile', dockerfileContents, {
            headers: { 'Content-Type': 'text/plain' }
        });

        const violations = response.data.violations;
        const vscodeResultPath = path.join(vscode.workspace.rootPath, '.vscode', 'result');
        if (!fs.existsSync(vscodeResultPath)) {
            fs.mkdirSync(vscodeResultPath);
        }

        const reportFileName = `report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const reportFilePath = path.join(vscodeResultPath, reportFileName);

        const newReportContent = JSON.stringify(violations, null, 4);

        // Compare the new report content with the last report content
        if (newReportContent !== lastReportContent) {
            fs.writeFileSync(reportFilePath, newReportContent);
            vscode.window.showInformationMessage('Validation complete. Report saved to .vscode/result');
            lastReportContent = newReportContent; // Update last report content

            // Upload the report
            await uploadReport(reportFilePath);
        } else {
            vscode.window.showInformationMessage('No new violations found. No report generated.');
        }

        return violations;
    } catch (error) {
        vscode.window.showErrorMessage('Error validating Dockerfile: ' + error.message);
        return null;
    }
}

// Function to upload report to the server
async function uploadReport(reportFilePath) {
    try {
        const form = new FormData();
        form.append('report', fs.createReadStream(reportFilePath));

        const response = await axios.post('http://localhost:3000/uploadreport', form, {
            headers: form.getHeaders()
        });

        vscode.window.showInformationMessage('Report uploaded: ' + response.data.file);
    } catch (error) {
        vscode.window.showErrorMessage('Error uploading report: ' + error.message);
    }
}

// Function to read package.json file
function readPackageJson() {
    const vscodePath = vscode.workspace.rootPath;
    const packageJsonPath = path.join(vscodePath, 'package.json');

    try {
        const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(packageJson);
    } catch (error) {
        vscode.window.showErrorMessage('Error reading package.json file: ' + error.message);
        return null;
    }
}

// Function to create diagnostic items with code description
function createDiagnosticItems(violations, dockerJson) {
    const diagnosticItems = [];
    const rules = dockerJson && dockerJson.rules ? dockerJson.rules : {};

    violations.forEach(violation => {
        const description = rules[violation.violationType] ? rules[violation.violationType].description : 'No description available';
        const range = new vscode.Range(new vscode.Position(violation.line - 1, 0), new vscode.Position(violation.line - 1, 0));
        const diagnostic = new vscode.Diagnostic(range, description, vscode.DiagnosticSeverity.Warning);
        diagnostic.code = violation.violationType; // Assign violation type as code
        diagnosticItems.push(diagnostic);
    });

    return diagnosticItems;
}

// Function to update decorations in the editor
async function updateDecorations() {
    if (!diagnosticCollection) {
        diagnosticCollection = vscode.languages.createDiagnosticCollection('dockerfile-violations');
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const dockerfilePath = findDockerfile();
    if (!dockerfilePath) {
        return;
    }

    const dockerJson = readDockerJson();
    if (!dockerJson) {
        return;
    }

    const violations = await validateDockerfile(dockerfilePath);
    if (!violations) {
        return;
    }

    const diagnosticItems = createDiagnosticItems(violations, dockerJson);
    diagnosticCollection.set(editor.document.uri, diagnosticItems);

    if (!decorationType) {
        decorationType = vscode.window.createTextEditorDecorationType({
            textDecoration: 'underline yellow wavy',
        });
    }

    editor.setDecorations(decorationType, violations.map(violation => new vscode.Range(new vscode.Position(violation.line - 1, 0), new vscode.Position(violation.line - 1, 0))));
}

// Command to run the extension
const disposable = vscode.commands.registerCommand('extension.checkDockerfile', async () => {
    await fetchDockerRules(); // Fetch the rules first
    const dockerfilePath = findDockerfile();
    if (dockerfilePath) {
        vscode.window.showInformationMessage('Checking Dockerfile for violations...');
        await updateDecorations();
    }
});

// Subscribe to editor events for dynamic updates
const subscriptions = vscode.Disposable.from(
    vscode.window.onDidChangeActiveTextEditor(updateDecorations),
    vscode.workspace.onDidChangeTextDocument(updateDecorations)
);

module.exports = {
    activate: function (context) {
        context.subscriptions.push(disposable, subscriptions);
    }
};
