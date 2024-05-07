const fs = require('fs');

function generateReport(violations, reportFilePath) {
    fs.writeFileSync(reportFilePath, JSON.stringify(violations, null, 4));
}

function generateHtmlReport(devmanViolations, ctcViolations, dockerViolations, packageJson, datetimeSuffix, htmlReportFilePath) {
    const devmanHtml = generateViolationTable(devmanViolations, 'DevMan Violations');
    const ctcHtml = generateViolationTable(ctcViolations, 'CTC Violations');
    const dockerHtml = generateViolationTable(dockerViolations, 'Dockerfile Violations');

    const summary = generateSummary(devmanViolations, ctcViolations, dockerViolations);

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
                .search-container {
                    margin-top: 10px;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <h1>Scan Report</h1>
            <p>Application Name: ${packageJson.name}</p>
            <p>Application Version: ${packageJson.version}</p>
            <p>Scan Date: ${datetimeSuffix}</p>
            ${summary}
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

    const html = `
        <h2>${title}:</h2>
        <table>
            <tr>
                <th>File</th>
                <th>Line Number</th>
                <th>Violation</th>
            </tr>
            ${violations.map(violation => `
                <tr>
                    <td>${violation.file || ''}</td>
                    <td>${violation.lineNumber !== -1 ? violation.lineNumber : '-'}</td>
                    <td>${violation.ruleMatched || violation.dependency || violation.violation}</td>
                </tr>
            `).join('')}
        </table>
    `;

    return html;
}

function generateSummary(devmanViolations, ctcViolations, dockerViolations) {
    const summary = `
        <h2>Summary:</h2>
        <p>Total DevMan Violations: ${devmanViolations.length}</p>
        <p>Total CTC Violations: ${ctcViolations.length}</p>
        <p>Total Dockerfile Violations: ${dockerViolations.length}</p>
    `;
    return summary;
}

module.exports = {
    generateHtmlReport,
    generateReport
};
