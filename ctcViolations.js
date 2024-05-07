// ctcViolations.js
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

module.exports = {
    checkCTCViolations
};
