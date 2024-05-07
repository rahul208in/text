// extension.js
const vscode = require('vscode');
const { activate } = require('./scanningOperations');

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
