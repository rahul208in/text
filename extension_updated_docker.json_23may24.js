const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

let diagnosticCollection;
let lastReportContent = '';
let ruleDescriptions = {}; // Store rule descriptions from docker.json

// Function to fetch docker rules from the API and save to docker.json
async function fetchDockerRules() {
    try {
        const response = await axios.get('http://localhost:3000/getDockerRule');
        const rules = response.data.rules;
        const vscodePath = vscode.workspace.rootPath;
        const dockerJsonPath = path.join(vscodePath, '.vscode', 'docker.json');

        fs.writeFileSync(dockerJsonPath, JSON.stringify({ rules }, null, 4));

        // Extract and store rule descriptions
        ruleDescriptions = rules.reduce((acc, rule) => {
            acc[rule.id] = rule.description;
            return acc;
        }, {});
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
        const rules = JSON.parse(dockerJson).rules;

        // Extract and store rule descriptions
        ruleDescriptions = rules.reduce((acc, rule) => {
            acc[rule.id] = rule.description;
            return acc;
        }, {});
        return rules;
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
            lastReportContent = newReportContent; // Update last report content
        }

        return violations;
    } catch (error) {
        vscode.window.showErrorMessage('Error validating Dockerfile: ' + error.message);
        return null;
    }
}

// Function to create diagnostic items with code description
function createDiagnosticItems(violations) {
    const diagnosticItems = [];

    violations.forEach(violation => {
        const description = ruleDescriptions[violation.rule] ? ruleDescriptions[violation.rule] : `No description available (${violation.rule})`;
        const range = new vscode.Range(new vscode.Position(violation.line - 1, 0), new vscode.Position(violation.line - 1, 100)); // Adjusted range end for better highlighting
        const diagnostic = new vscode.Diagnostic(range, description, vscode.DiagnosticSeverity.Warning);
        diagnostic.code = violation.rule; // Assign violation type as code
        diagnosticItems.push(diagnostic);
    });

    return diagnosticItems;
}

// Function to update diagnostics in the editor
async function updateDiagnostics() {
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

    const diagnosticItems = createDiagnosticItems(violations);
    diagnosticCollection.set(editor.document.uri, diagnosticItems);
}

// Hover provider to show rule descriptions on hover
const hoverProvider = vscode.languages.registerHoverProvider('dockerfile', {
    provideHover(document, position) {
        const diagnostics = diagnosticCollection.get(document.uri);
        if (diagnostics) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.range.contains(position)) {
                    const description = diagnostic.message;
                    if (description) {
                        return new vscode.Hover(description);
                    }
                }
            }
        }
        return null;
    }
});

// Command to run the extension
const disposable = vscode.commands.registerCommand('extension.checkDockerfile', async () => {
    await fetchDockerRules(); // Fetch the rules first
    const dockerfilePath = findDockerfile();
    if (dockerfilePath) {
        await updateDiagnostics();
    }
});

// Subscribe to editor events for dynamic updates
const subscriptions = vscode.Disposable.from(
    vscode.window.onDidChangeActiveTextEditor(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(updateDiagnostics)
);

module.exports = {
    activate: function (context) {
        context.subscriptions.push(disposable, subscriptions, hoverProvider);
    }
};
