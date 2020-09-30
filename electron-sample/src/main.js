// Copyright 2018, JINS Inc., all rights reserved

// アプリケーション作成用のモジュールを読み込み、インスタンスを作成
module.exports.noble_type = 'noble-winrt';
const memeDevice = require('jinsmemesdk-node-noble-x');
let memeDevice1 = new memeDevice();
let memeDevice2 = new memeDevice();

//アプリケーションを認証する
memeDevice1.setAppClientID("app_id", "app_secret",
  function(){
    console.log("App authorization succeeded.");
  },
  function(){
    console.log("App authorization failed.")
  }
);

const electron = require('electron');
const {app, BrowserWindow, ipcMain} = require('electron');
let device_to_connect;

// メインウィンドウ
let mainWindow;
const path = require('path');
const url = require('url');

//カウンター
const createCounter = () => {
  let cnt = 0;
  return function () {
      return cnt++;
  };
};

const counter1 = createCounter();
const counter2 = createCounter();

//nodeの捕捉されなかったPromise内の例外をスタックトレースで表示
process.on('unhandledRejection', console.dir);

const createWindow = () => {
  // メインウィンドウを作成します
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // メインウィンドウに表示するURLを指定
  mainWindow.loadFile('index.html');

  // デベロッパーツールの起動
  mainWindow.webContents.openDevTools();

  // メインウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

//  初期化が完了した時の処理
app.on('ready', createWindow);

// 全てのウィンドウが閉じたときの処理
app.on('window-all-closed', () => {
  //切断しないとelectronが終了しないので、明示的に切断
  memeDevice1.disconnect();
  memeDevice2.disconnect();
  // macOSのとき以外はアプリケーションを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリケーションがアクティブになった時の処理(Macだと、Dockがクリックされた時）
app.on('activate', () => {
  // メインウィンドウが消えている場合は再度メインウィンドウを作成する
  if (mainWindow === null) {
    createWindow();
  }
});

//display message in renderer
memeDevice1.on('status-log', (msg) => {
  mainWindow.webContents.send('status-msg', ('memeDevice1: ' + msg));
});
memeDevice2.on('status-log', (msg) => {
  mainWindow.webContents.send('status-msg', ('memeDevice2: ' + msg));
});

//スキャン開始の受信
ipcMain.on('start-stop-scan', (event, arg) => {
  if(arg == 1){
    memeDevice1.scan();
  }
  if(arg == 2){
    memeDevice2.scan();
  }
  //どのインスタンスへの接続ダイアログの記録、connectまで保持
  device_to_connect = arg;
})

//スキャン＆接続（MACアドレス指定接続用）
ipcMain.on('scan-and-connect', (event, arg) => {
  if(arg == 1){
    memeDevice1.scanAndConnect('mac_addr_to_connect');
  }
  if(arg == 2){
    memeDevice2.scanAndConnect('mac_addr_to_connect');
  }
})

//見つかったデバイスをメインウィンドウに知らせる
memeDevice1.on('device-discovered', (device) => {
  if(device_to_connect == 1){
    //使用するnoble moduleによってdeviceのserializeに失敗するので、必要な情報のみ渡す
    const deviceInfo = {mac_addr: device.mac_addr, rssi: device.rssi}
    mainWindow.webContents.send('reply-to-mainwindow', deviceInfo)
  }
})
memeDevice2.on('device-discovered', (device) => {
  if(device_to_connect == 2){
    const deviceInfo = {mac_addr: device.mac_addr, rssi: device.rssi}
    mainWindow.webContents.send('reply-to-mainwindow', deviceInfo)
  }
})

//接続の受信と指示
ipcMain.on('connect-device', (event, arg) => {
  if(device_to_connect == 1){
    memeDevice1.connect(arg, 1);
  }
  if(device_to_connect == 2){
    memeDevice2.connect(arg, 1);
  }
  device_to_connect = null;
})


//リアルタイムモードを処理するコールバック、デバイスごとに分けてもOK
const realtimeModeCB_dev1 = data => {
  let cnt = counter1();
  //1秒に1回データをコンソールに吐く
  if(cnt % 20 == 0){
    console.log(`dev1: ${cnt} : ${data.accZ}`);
  }
}
const realtimeModeCB_dev2 = data => {
  let cnt = counter2();
  if(cnt % 20 == 0){
      console.log(`dev2: ${cnt} : ${data.accX}`);
  }
}

//コマンドの受信
ipcMain.on('meme-command', (event, arg) => {
  let memeDevice_;
  if (arg.device == 1){
    memeDevice_ = memeDevice1;
    callback = realtimeModeCB_dev1;
  }
  if (arg.device == 2){
    memeDevice_ = memeDevice2;
    callback = realtimeModeCB_dev2;
  }
  switch( arg.command ) {
    case 99:
      memeDevice_.disconnect();
      break;
    case 3:
      memeDevice_.setMemeMode();
      break;
    case 4:
      memeDevice_.startDataReport(callback);
      break;
    case 5:
      memeDevice_.stopDataReport();
      break;
    case 6:
      memeDevice_.setAutoReconnect(true);
      break;
    case 7:
      memeDevice_.setAutoReconnect(false);
      break;
    case 8:
      memeDevice_.getMemeMode();
      break;
    case 9:
      memeDevice_.getMemeDevInfo();
      break;
    case 10:
      console.log(memeDevice_.getHWVersion());
      break;
    case 11:
      console.log(memeDevice_.getFWVersion());
      break;
    case 98:
      memeDevice_.status();
      break;  }
})

//characteristic取得後後処理
memeDevice1.on('device-status', (arg) => {
  if(arg.status == 1){
  }
});
memeDevice2.on('device-status', (arg) => {
  if(arg.status == 1){
    //自動再接続をオンにする
    memeDevice2.setAutoReconnect(true);
    //自動的にリアルタイムモードデータを取得する
    memeDevice2.startDataReport(realtimeModeCB_dev2);
  }
});
