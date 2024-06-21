const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

let credentials = null;

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('apiViewer.showAPIData', async () => {
        if (!credentials) {
            credentials = await askForCredentials();
        }

        const panel = vscode.window.createWebviewPanel(
            'apiViewer',
            'API Viewer',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        const jsonPath = path.join(context.extensionPath, 'data', 'apis.json');
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

        panel.webview.html = await getWebviewContent(jsonData);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'refresh') {
                const responseContent = await getApiResponseContent(jsonData.endpoints[message.endpointIndex]);
                panel.webview.postMessage({ command: 'update', index: message.endpointIndex, content: responseContent });
            }
        });
    }));
}

async function askForCredentials() {
    const username = await vscode.window.showInputBox({ prompt: 'Enter your username' });
    const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true });
    return { username: username, password: password };
}

async function getWebviewContent(jsonData) {
    let tabsHTML = '';
    let tabsCSS = '';
    let responseContent = [];

    for (let i = 0; i < jsonData.endpoints.length; i++) {
        const endpoint = jsonData.endpoints[i];
        const content = await getApiResponseContent(endpoint);
        responseContent.push(content);

        tabsHTML += `
            <button class="tablinks" onclick="openTab(event, 'tab${i}')">${endpoint.name}</button>
        `;

        tabsCSS += `
            #tab${i} {
                display: none;
                padding: 10px;
            }
            #tab${i} table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            #tab${i} th, #tab${i} td {
                padding: 8px 12px;
                text-align: left;
                border: 1px solid #ddd;
            }
            #tab${i} th {
                background-color: #f2f2f2;
            }
            #tab${i} .refresh-button {
                margin-top: 10px;
                padding: 10px 20px;
                background-color: #007acc;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                display: block; /* Ensure refresh button is displayed as a block element */
                margin-bottom: 10px; /* Add margin below refresh button */
            }
            #tab${i} .refresh-button:hover {
                background-color: #005f99;
            }
        `;
    }

    return `
        <html>
            <head>
                <style>
                    .tab {
                        overflow: hidden;
                        border: 1px solid #ccc;
                        background-color: #f1f1f1;
                    }
                    .tab button {
                        background-color: inherit;
                        float: left;
                        border: none;
                        outline: none;
                        cursor: pointer;
                        padding: 14px 16px;
                        transition: 0.3s;
                    }
                    .tab button:hover {
                        background-color: #ddd;
                    }
                    .tab button.active {
                        background-color: #ccc;
                    }
                    ${tabsCSS}
                </style>
            </head>
            <body>
                <div class="tab">
                    ${tabsHTML}
                </div>
                ${jsonData.endpoints.map((endpoint, index) => `
                    <div id="tab${index}" class="tabcontent">
                        <table border="1">
                            <thead>
                                <tr>
                                    <th colspan="2">${endpoint.name} Response</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${responseContent[index]}
                            </tbody>
                        </table>
                        <button class="refresh-button" onclick="refresh(${index})">Refresh ${endpoint.name}</button>
                    </div>
                `).join('')}
                <script>
                    const vscode = acquireVsCodeApi();

                    function openTab(evt, tabName) {
                        var i, tabcontent, tablinks;
                        tabcontent = document.getElementsByClassName("tabcontent");
                        for (i = 0; i < tabcontent.length; i++) {
                            tabcontent[i].style.display = "none";
                        }
                        tablinks = document.getElementsByClassName("tablinks");
                        for (i = 0; i < tablinks.length; i++) {
                            tablinks[i].className = tablinks[i].className.replace(" active", "");
                        }
                        document.getElementById(tabName).style.display = "block";
                        evt.currentTarget.className += " active";
                    }

                    function refresh(endpointIndex) {
                        vscode.postMessage({ command: 'refresh', endpointIndex: endpointIndex });
                    }

                    document.getElementsByClassName("tablinks")[0].click();

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'update') {
                            const tabContent = document.getElementById('tab' + message.index).querySelector('tbody');
                            tabContent.innerHTML = message.content;
                        }
                    });
                </script>
            </body>
        </html>
    `;
}

async function getApiResponseContent(endpoint) {
    let content = '';

    try {
        const response = await axios({
            method: endpoint.method,
            url: endpoint.url,
            auth: endpoint.cred ? credentials : undefined
        });

        if (endpoint.name === 'Get User Info') {
            content = createUserTable(response.data);
        } else if (endpoint.name === 'Get Orders') {
            content = createOrdersTable(response.data);
        } else {
            content = `
                <tr>
                    <td>${JSON.stringify(response.data)}</td>
                </tr>
            `;
        }
    } catch (error) {
        content = `
            <tr>
                <td>Error: ${error.message}</td>
            </tr>
        `;
    }

    return content;
}

function createUserTable(data) {
    return `
        <tr>
            <td>Name</td>
            <td>${data.name}</td>
        </tr>
        <tr>
            <td>Email</td>
            <td>${data.email}</td>
        </tr>
        <tr>
            <td>Username</td>
            <td>${data.username}</td>
        </tr>
    `;
}

function createOrdersTable(data) {
    if (!data.orders || !Array.isArray(data.orders)) {
        return `
            <tr>
                <td colspan="4">No orders found</td>
            </tr>
        `;
    }

    let rows = '';
    data.orders.forEach(order => {
        rows += `
            <tr>
                <td>${order.id}</td>
                <td>${order.item}</td>
                <td>${order.quantity}</td>
                <td>${order.price}</td>
            </tr>
        `;
    });

    return rows;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
