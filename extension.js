const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Function to generate a formatted timestamp
function getFormattedTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hour}${minute}${second}`;
}


// Function to determine the project type based on the presence of specific files in the project base directory
function getProjectType() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.warn('No workspace folders found.');
        return 'Unknown'; // Unable to determine project type if no workspace folders are found
    }

    const projectRoot = workspaceFolders[0].uri.fsPath; // Get the root path of the first workspace folder

    // Check if package-lock.json exists in the sss folder
    const packageJsonPath = path.join(projectRoot, 'sss', 'package-lock.json');
    if (fs.existsSync(packageJsonPath)) {
        return 'JavaScript'; // If package-lock.json exists in the sss folder, it's a JavaScript project
    }

    return 'Unknown'; // Unable to determine project type if neither file is found
}



// Function to create a directory if it doesn't exist
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

// Function to inspect open-source dependencies
function inspectDependencies() {
    const ruleFilePath = path.join(__dirname, '.vscode', 'ctcrule.json');
    try {
        const rules = JSON.parse(fs.readFileSync(ruleFilePath, 'utf8'));
        const projectType = getProjectType(); // Determine project type

        // Read project file based on project type
        let projectFilePath;
        if (projectType === 'JavaScript') {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.warn('No workspace folders found.');
                return; // Unable to determine project type if no workspace folders are found
            }
            const projectRoot = workspaceFolders[0].uri.fsPath; // Get the root path of the first workspace folder
            projectFilePath = path.join(projectRoot, 'sss', 'package-lock.json');
        } else if (projectType === 'SpringBootJava') {
            projectFilePath = 'pom.xml';
        } else {
            console.error("Unsupported project type.");
            return;
        }

        const projectDependencies = readProjectDependencies(projectFilePath);

        // Compare project dependencies with rules
        const report = {
            timestamp: getFormattedTimestamp(),
            findings: []
        };

        rules.libraries.forEach(library => {
            const projectLibrary = projectDependencies.find(dep => dep.name === library.name);
            if (projectLibrary) {
                // Check if the version matches the rule
                if (projectLibrary.version === library.version) {
                    if (library.status === 'rejected' || library.status === 'prohibited') {
                        report.findings.push({ library: library.name, issue: `Version ${library.version} is ${library.status}` });
                    }
                } else {
                    if (library.status === 'rejected') {
                        report.findings.push({ library: library.name, issue: `Version ${projectLibrary.version} of ${library.name} is used instead of rejected version ${library.version}` });
                    }
                }
            } else {
                if (library.status === 'rejected') {
                    report.findings.push({ library: library.name, issue: `Rejected library ${library.name} is not found in project dependencies` });
                }
            }
        });

        // Write report to file
        ensureDirectoryExists(path.join(__dirname, '.vscode', 'result')); // Ensure .vscode/result folder exists
        fs.writeFileSync(path.join(__dirname, '.vscode', 'result', 'ctcscan_report.json'), JSON.stringify(report, null, 2));
    } catch (error) {
        console.error(`Error reading or processing ${ruleFilePath}:`, error);
    }
}

// Function to verify presence of readme file
function verifyReadme() {
    const readmeExists = fs.existsSync('README.md');
    const report = {
        missingFile: "README.md",
        timestamp: getFormattedTimestamp()
    };
	ensureDirectoryExists('.vscode/result'); // Ensure .vscode/result folder exists
    if (!readmeExists) {
        fs.writeFileSync('.vscode/result/archt.json', JSON.stringify(report, null, 2));
    }
}

// Function to scan project files for sensitive information
function scanForSensitiveInfo() {
    const ruleFilePath = path.join(__dirname, '.vscode', 'devman.json');
	
    try {
        const rules = JSON.parse(fs.readFileSync(ruleFilePath, 'utf8'));

        // Code to scan project files for sensitive information based on rules and generate report
        // Sample implementation: check for sensitive keywords in project files
        const sensitiveKeywords = rules.sensitiveKeywords;
        const report = {
            timestamp: getFormattedTimestamp(),
            findings: []
        };

        // Determine project type to exclude specific folders
        const projectType = getProjectType();

        // Function to check if a folder should be excluded based on project type
        function shouldExcludeFolder(folderName) {
            if (projectType === 'JavaScript') {
                return folderName === 'node_modules';
            } else if (projectType === 'SpringBootJava') {
                return folderName === 'target';
            }
            return false; // Exclude nothing by default
        }

        // Recursive function to scan folders and files
        function scanFolder(folderPath) {
            const files = fs.readdirSync(folderPath);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    if (!shouldExcludeFolder(file)) {
                        scanFolder(filePath);
                    }
                } else {
                    // Exclude folders and files that should be ignored
                    if (!shouldExcludeFolder(folderPath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        sensitiveKeywords.forEach(keyword => {
                            if (content.includes(keyword)) {
                                report.findings.push({ file: filePath, keyword: keyword });
                            }
                        });
                    }
                }
            });
        }

        // Start scanning from the project root
        scanFolder('.');

		        // Ensure .vscode/result folder exists
				ensureDirectoryExists('.vscode/result');

        // Write report to file
        fs.writeFileSync('.vscode/result/devman_report.json', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error(`Error reading or processing ${ruleFilePath}:`, error);
    }
}

// Function to read project dependencies from the specified file
function readProjectDependencies(filePath) {
    // Logic to read project dependencies from file
    // For simplicity, let's assume it returns an array of dependencies with name and version
    // Sample implementation for package.json
    if (filePath === 'package.json') {
        const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const dependencies = Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({ name, version }));
        const devDependencies = Object.entries(packageJson.devDependencies || {}).map(([name, version]) => ({ name, version }));
        return [...dependencies, ...devDependencies];
    } else if (filePath === 'pom.xml') {
        // Sample implementation for pom.xml
    } else if (filePath === 'package-lock.json') {
		const packageLockJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const dependencies = Object.entries(packageLockJson.packages || {}).map(([name, info]) => ({ name, version: info.version }));
        const devDependencies = Object.entries(packageLockJson.packages || {}).map(([name, info]) => {
            if (info.dev) {
                return { name, version: info.version };
            }
        }).filter(dep => dep !== undefined);
        return [...dependencies, ...devDependencies];
    }
}

// Register the command to generate reports
exports.activate = function(context) {
    let disposable = vscode.commands.registerCommand('sss.generateReports', () => {
		vscode.window.showInformationMessage('Generating reports...');
        inspectDependencies();
        verifyReadme();
        scanForSensitiveInfo();
    });
    context.subscriptions.push(disposable);
};

exports.deactivate = function() {};
