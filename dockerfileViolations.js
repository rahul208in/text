// dockerfileViolations.js
const vscode = require('vscode');

async function checkDockerfileViolations(content, ruleFilePath, filePath) {
    const dockerfileViolations = [];
    const lines = content.split('\n');

    try {
        const ruleFileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(ruleFilePath));
        const dockerRules = JSON.parse(ruleFileContent.toString()).rules;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('FROM')) {
                if (line.includes('latest')) {
                    console.log('Detected violation: latest tag in FROM statement');
                    dockerfileViolations.push({ violation: dockerRules.FROMImageVersion.description, file: filePath, lineNumber: i + 1 });
                }
            } else if (line.startsWith('USER')) {
                if (line.includes('root')) {
                    console.log('Detected violation: root user in USER statement');
                    dockerfileViolations.push({ violation: dockerRules.ContainerUser.description, file: filePath, lineNumber: i + 1 });
                }
            }
        }
    } catch (error) {
        console.error('Error checking Dockerfile violations:', error);
        // Handle error, e.g., throw error or return empty violations array
    }

    return dockerfileViolations;
}


module.exports = {
    checkDockerfileViolations
};
