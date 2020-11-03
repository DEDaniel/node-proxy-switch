const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform !== 'darwin';

let mainWindow;
let tray;

let filePath;
let fileData;

let currentHttpProxy;
let currentHttpsProxy;

let httpProxyStatus;
let httpsProxyStatus;

app.on('ready', () => {

    // initial call
    updateFileStatus();

    mainWindow = new BrowserWindow({
        width: 400,
        height: 315,
        show: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.once('dom-ready', () => {
        console.log('ready to show', httpProxyStatus);
        mainWindow.webContents.send('changed-proxy-settings', {
            http: currentHttpProxy,
            https: currentHttpsProxy,
            isProxyActive: httpProxyStatus
        });
    });

    // wait till we know the initial httpProxyStatus
    // this will affect the menu item defaul selection (enabled or disabled)
    setTimeout(() => {
        createTray();
    }, 100);
});

app.on('quit', () => {
    app.quit();
});

createTray = () => {
    console.log('createTray', httpProxyStatus);

    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, nativeTheme.shouldUseDarkColors ? '/assets/icon.png' : '/assets/icon-white.png')));
    setTrayImage(httpProxyStatus);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Enable Proxy', type: 'radio', checked: httpProxyStatus, click: () => { enableProxy() } },
        { label: 'Disable Proxy', type: 'radio', checked: !httpProxyStatus, click: () => { disableProxy() } },
        { label: 'Open Settings', type: 'normal', click: () => { openSettings() } },
        { label: 'Exit', type: 'normal', click: () => { app.quit() } }
    ]);
    tray.setToolTip('Node Proxy Switch');
    tray.setContextMenu(contextMenu);
}

setTrayImage = (isProxyActive) => {
    console.log('setTrayImage', isProxyActive);

    let image;
    if (isProxyActive) {
        image = nativeImage.createFromPath(path.join(__dirname, nativeTheme.shouldUseDarkColors ?  '/assets/icon.png' : '/assets/icon-white.png'));
    } else {
        image = nativeImage.createFromPath(path.join(__dirname, nativeTheme.shouldUseDarkColors ?  '/assets/icon-disabled.png' : '/assets/icon-white-disabled.png'));
    }

    if (!isWindows) image = image.resize({ width: 25 });

    tray.setImage(image);
}

openSettings = () => {
    console.log('openSettings');

    mainWindow.webContents.send('changed-proxy-settings', {
        http: currentHttpProxy,
        https: currentHttpsProxy,
        isProxyActive: httpProxyStatus
    });

    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
}

enableProxy = () => {
    console.log('enableProxy');

    updateFileStatus().then(() => {
        if (fileData) {
            let data = '';
            fileData.split('\n').forEach(line => {
                if (line.includes('proxy') && line.startsWith(';')) {
                    line = line.replace('; ', '');
                    console.log(`replaced line to ${line}`);
                }
                data += line + '\n';
            });
            console.log('changed data', data);
            if (data) {
                writeFile(data).then(() => {
                    console.log('successfully enabled proxy!');
                    httpProxyStatus = true;
                    httpsProxyStatus = true;
                    setTrayImage(true);
                });
            }
        } else {
            console.error('Where is the data?!');
        }
    });
}

disableProxy = () => {
    console.log('disableProxy');

    updateFileStatus().then(() => {
        if (fileData) {
            let data = '';
            fileData.split('\n').forEach(line => {
                if (line.includes('proxy') && !line.startsWith(';')) {
                    line = '; ' + line;
                    console.log(`replaced line to ${line}`);
                }
                data += line + '\n';
            });
            console.log('changed data', data);
            if (data) {
                writeFile(data).then(() => {
                    console.log('successfully disabled proxy!');
                    httpProxyStatus = false;
                    httpsProxyStatus = false;
                    setTrayImage(false);
                });
            }
        } else {
            console.error('Where is the data?!');
        }
    });
}

updateFileStatus = () => {
    return new Promise((resolve, reject) => {
        if (!filePath) {
            filePath = path.join(app.getPath('home'), '/.npmrc');
        }
        console.log(`updateFileStatus of ${filePath}`);

        fs.access(filePath, fs.F_OK, (err) => {
            if (err) {
                console.error(err);
                reject(`Can't access file at path ${filePath}.`);
                return;
            }
            console.log('npmrc file exists');

            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    reject(`Can't read file at path ${filePath}.`);
                    return;
                }

                fileData = data;

                data.split('\n').forEach(line => {
                    if (line.startsWith('; proxy') || line.startsWith('proxy')) {
                        // ; proxy = "..." or proxy = "..."
                        currentHttpProxy = line.split('"')[1];
                        httpProxyStatus = line.includes('; ') ? false : true;
                    } else if (line.startsWith('; https-proxy') || line.startsWith('https-proxy')) {
                        // ; https-proxy = "..." or https-proxy = "..."
                        currentHttpsProxy = line.split('"')[1];
                        httpsProxyStatus = line.includes('; ') ? false : true;
                    }
                });
                console.log('proxy status', httpProxyStatus);
                console.log('readFile data', fileData);

                resolve();
            });
        });
    });
}

writeFile = (data) => {
    return new Promise((resolve, reject) => {
        if (filePath) {

            // remove last line ending
            if (data.endsWith('\n')) {
                data = data.slice(0, -1);
            }

            console.log(`trying to write to ${filePath}`, data);
            fs.writeFile(filePath, data, 'utf8', err => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                resolve();
            });
        } else {
            console.warn(`Can't write since the file hasn't been updated before.`);
        }
    });
}

ipcMain.on('apply-proxy-settings', (event, arg) => {
    console.log('apply-proxy-settings', arg);

    updateFileStatus().then(() => {
        let data = '';
        if (fileData) {
            fileData.split('\n').forEach(line => {
                if (line.includes('https-proxy')) {
                    if (line.startsWith('; ')) {
                        line = '; https-proxy = "' + arg.https + '"';
                    } else {
                        line = 'https-proxy = "' + arg.https + '"';
                    }
                } else if (line.includes('proxy')) {
                    if (line.startsWith('; ')) {
                        line = '; proxy = "' + arg.http + '"';
                    } else {
                        line = 'proxy = "' + arg.http + '"';
                    }
                }

                data += line + '\n';
            });

            // .npmrc file does not contain any proxy settings yet
            if (!data.includes('proxy') || !data.includes('https-proxy')) {
                data += `proxy = "${arg.http}"\n`;
                data += `https-proxy = "${arg.https}"\n`;
                console.log('added proxy settings to .npmrc file');
            }
        } else {
            // the file seems to be empty...
            // what about any errors at this point?
            data += `proxy = "${arg.http}"\n`;
            data += `https-proxy = "${arg.https}"\n`;
            console.log('added proxy settings to .npmrc file');
        }
        if (data) {
            writeFile(data).then(() => {
                console.log('successfully applied proxy settings!')
            });
        }
    });
});

ipcMain.on('enable-proxy-settings', () => {
    enableProxy();
});

ipcMain.on('disable-proxy-settings', () => {
    disableProxy();
});