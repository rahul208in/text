// devManViolations.js
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

module.exports = {
    checkDevManViolations
};
