# monachatjp-userscript

[Unity版もなちゃと](https://monachat.jp/)を拡張するuserscript

まだ試作の段階です。

## ライセンス

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png) ](https://creativecommons.org/publicdomain/zero/1.0/deed.ja)

## 導入方法

1. Chromeで[Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=ja)をインストール
2. [userscript](https://raw.githubusercontent.com/iwamizawa-software/monachatjp-userscript/master/monachatjp.user.js)をインストール

## 開発者向けの説明

このuserscriptを導入すると、window.openやiframeを使ってもなちゃとを表示することで、データの送受信ができるようになります。

入退室と発言の受信はwindowのmessageイベントで出来ます。発言の送信はpostMessage({type: 'COM', attr: {cmt: '発言'}})で出来ます。
