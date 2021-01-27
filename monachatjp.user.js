// ==UserScript==
// @name     monachatjp-userscript
// @version  5
// @run-at document-start
// @grant    none
// @match        https://monachat.jp/
// @match        https://*.monachat.jp/
// ==/UserScript==

(function (script, source){
  localStorage.removeItem('monachat');
  script.appendChild(document.createTextNode('!' + source + '()'));
  document.querySelector('head').appendChild(script);
})(document.createElement('script'), function () {

  var ondata = function (obj) {
    (window.debug ? {postMessage: console.log.bind(console)} : (window.opener || (window.parent && parent === window ? {postMessage: a => 0} : parent))).postMessage(obj, '*');
    if (window.Unimona && typeof Unimona.ondata === 'function')
      Unimona.ondata(obj);
  };
  window.onbeforeunload = () => '閉じますか';

  var log = document.createElement('textarea');
  log.style.width = '960px';
  log.style.height = '200px';
  log.readOnly = true;
  log.ondblclick = function () {
    var url = log.value.slice(Math.max(0, log.value.lastIndexOf('\n', log.selectionStart)), Math.max(log.value.length, log.value.indexOf('\n', log.selectionStart))).match(/https?:\/\/[\S]+/);
    if (url)
      open(url[0], '_blank', 'noopener');
  };
  var tempLog = [];
  var addLog = function (s) {
    if (!log.parentNode)
      return;
    if (document.getElementById('pause').checked)
      return tempLog.push(s);
    log.value += s + '\r\n';
    log.scrollTop = log.scrollHeight;
  };
  var resumeLog = function () {
    if (!tempLog.length)
      return;
    addLog(tempLog.join('\r\n'));
    tempLog = [];
  };

  var buf2hex = buf => [].slice.call(new Uint8Array(buf)).map(c => (c >> 4 ? '' : '0') + c.toString(16)).join('');
  var hex2buf = hex => (new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)))).buffer;
  var hex2str = hex => decodeURIComponent(hex.replace(/../g, h => '%' + h));
  var int2hex = function (n, size) {
    var s = n.toString(16);
    return Array(size * 2 - s.length + 1).join('0') + s;
  };
  var utf8encoder = new TextEncoder();
  
  var Chat = function () {
    var member, myId, toPlugin = function (obj) {
      var id = obj.attr && obj.attr.id, text = {ENTER: 'が入室', EXIT: 'が退室', COM: '：　' + (obj.attr && obj.attr.cmt)}[obj.type];
      if (text)
        addLog(member[id].name + member[id].trip + ' (ID:' + id + ')' + text + ' [' + (new Date()).toLocaleString() + ']');
      ondata(obj);
    };
    (this.init = () => {
      member = {};
      myId = undefined;
      this.isAvailable = false;
      this.commentQueue = [];
    })();
    this.addMember = function (hex, init) {
      var id = parseInt(hex.slice(-8), 16);
      var user = member[id] = {id : id};
      var tripLength = parseInt(hex.slice(0, 4), 16), tripEnd = 4 + tripLength * 2;
      user.trip = hex2str(hex.slice(4, tripEnd));
      var nameLength = parseInt(hex.slice(tripEnd + 6, tripEnd + 10), 16);
      user.name = hex2str(hex.slice(tripEnd + 10, tripEnd + 10 + nameLength * 2));
      user.ihash = '0000000000';
      if (!init)
        toPlugin({type: 'ENTER', attr: user});
    };
    this.removeMember = function (id) {
      if (id === undefined)
        return;
      toPlugin({type: 'EXIT', attr: {id: id}});
      delete member[id];
      if (myId === id)
        myId = undefined;
    };
    this.comment = function (hex) {
      var id = parseInt(hex.slice(-8), 16);
      var length = parseInt(hex.slice(0, 4), 16);
      if (length)
        toPlugin({type: 'COM', attr: {id: id, cmt: hex2str(hex.slice(4, 4 + length * 2))}});
    };
    this.enter = function (id) {
      this.isAvailable = true;
      toPlugin({type: 'CONNECT', attr: {id: myId = id}});
      toPlugin({type: 'ROOM', children: Object.values(member)});
    };
    this.exit = function () {
      if (!this.isAvailable)
        return;
      this.removeMember(myId);
      this.isAvailable = false;
    };
    this.sendComment = function (cmt) {
      if (!this.isAvailable || !cmt)
        return;
      var hex = buf2hex(utf8encoder.encode(cmt).buffer), size = (hex.length >> 1).toString(16);
      this.commentQueue.push(int2hex(size, 2) + hex);
      window.dispatchEvent(new KeyboardEvent('keydown', {keyCode: 13}));
      window.dispatchEvent(new KeyboardEvent('keyup', {keyCode: 13}));
    };
    this.getMyId = () => myId;
  };

  var originalWebSocket = WebSocket;
  var chat = new Chat();
  window.WebSocket = function (url, proto) {
    var s = new originalWebSocket(url, proto);
    s.addEventListener('message', function (e) {
      if (s.binaryType !== 'arraybuffer')
        return;
      try {
        var hex = buf2hex(e.data);
        if (!hex.indexOf('f303e200002a') && hex.slice(18, 20) === '69') {
          chat.init();
          var memberHex = hex.split('6800037300047472697073');
          for (var i = 1; i < memberHex.length; i++)
            chat.addMember(memberHex[i] + memberHex[i - 1], true);
          chat.enter(parseInt(hex.slice(20, 28), 16));
        } else if (!hex.indexOf('f304ff0003f96800037300047472697073')) {
          chat.addMember(hex.slice(34));
        } else if (!hex.indexOf('f304c80002f568000362056213620269')) {
          chat.removeMember(parseInt(hex.slice(-8), 16));
        } else if (!hex.indexOf('f304c80002f56800046205621a62047a000373')) {
          chat.comment(hex.slice(38));
        }
      } catch (err) {
        console.log(err);
      }
    });
    s.addEventListener('close', function (e) {
      chat.exit();
    });
    s.send = function (buf) {
      if (s.binaryType === 'arraybuffer') {
        var hex = buf2hex(buf);
        if (!hex.indexOf('f302fd0002f462c8f5680004620069')) {
          var commentData = hex.split('6205621a62047a000373');
          if (commentData[1]) {
            if (!parseInt(commentData[1].slice(0, 4), 16) && chat.commentQueue.length)
              buf = hex2buf(commentData[0] + '6205621a62047a000373' + (commentData[1] = chat.commentQueue.shift() + '69000000016900000001'));
            chat.comment(commentData[1] + int2hex(chat.getMyId(), 4))
          }
        }
      }
      return originalWebSocket.prototype.send.call(this, buf);
    };
    return s;
  };
  WebSocket.__proto__ = originalWebSocket;
  
  addEventListener('load', function () {
    var unityContainer = document.getElementById('unityContainer');
    unityContainer.style.margin = '0 auto';
    document.querySelector('.webgl-content').className = '';
    if (window.parent !== window) {
      document.body.style.overflow = document.documentElement.style.overflow = 'hidden';
      document.body.style.margin = '0';
    } else {
      document.body.insertBefore(log, document.body.firstChild);
      document.body.insertBefore(document.createElement('p'), document.body.firstChild).innerHTML = '<input type="checkbox" id="pause"><label for="pause">一時停止</labe><input type="button" id="clear" value="クリア">';
      document.getElementById('clear').onclick = function () {
        if (confirm('ログを消します'))
          log.value = '';
      };
      document.getElementById('pause').onclick = function () {
        if (!this.checked)
          resumeLog();
      };
    }
    document.body.style.textAlign = 'center';
    ondata({type: 'load'});
  });
  addEventListener('unload', function () {
    ondata({type: 'close'});
  });
  addEventListener('message', function (e) {
    if (e.data.type === 'COM')
      chat.sendComment(e.data.attr.cmt);
  });
  window.Unimona = {send: chat.sendComment.bind(chat)};
});
