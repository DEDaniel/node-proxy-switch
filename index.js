const { ipcRenderer } = require('electron');

const httpInput = document.getElementById('http-proxy');
const httpsInput = document.getElementById('https-proxy');

function applyProxySettings() {
    console.log('applyProxySettings');
    ipcRenderer.send('apply-proxy-settings', {
        http: httpInput.value,
        https: httpsInput.value
    });
}

function enableProxySettings() {
    console.log('enableProxySettings');
    ipcRenderer.send('enable-proxy-settings');
    $('#enableProxyBtn').hide();
    $('#disableProxyBtn').show();
}

function disableProxySettings() {
    console.log('disableProxySettings');
    ipcRenderer.send('disable-proxy-settings');
    $('#enableProxyBtn').show();
    $('#disableProxyBtn').hide();
}

ipcRenderer.on('changed-proxy-settings', (event, data) => {
    console.log('changed-proxy-settings', data);
    httpInput.value = data.http;
    httpsInput.value = data.https;

    if (data.isProxyActive) {
        $('#enableProxyBtn').hide();
        $('#disableProxyBtn').show();
    } else {
        $('#enableProxyBtn').show();
        $('#disableProxyBtn').hide();
    }
});