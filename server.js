// 你畫我猜 Draw & Guess - 即時多人遊戲
// 跑法: npm install && node server.js  -> 開 http://localhost:3000
// 需要 Node 18+

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const OpenCC = require('opencc-js'); // 簡繁正規化

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ---- 簡繁轉換: 一律轉成簡體當作比對基準 (繁->簡, 簡保持) ----
const toSimp = OpenCC.Converter({ from: 'tw', to: 'cn' });
function normalize(s) {
  if (!s) return '';
  // 去空白、標點、轉小寫、繁轉簡
  const cleaned = String(s).trim().toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  try { return toSimp(cleaned); } catch { return cleaned; }
}

// ---- 預設詞庫 (依難度) ----
const DEFAULT_WORDS = {
  簡單: ['太陽','貓','蘋果','房子','雨傘','汽車','花','魚','月亮','蛋糕','眼鏡','時鐘','腳踏車','香蕉','雪人'],
  普通: ['火山','機器人','燈塔','吉他','長頸鹿','摩天輪','潛水艇','仙人掌','漢堡','彩虹','章魚','熱氣球','滑板','風箏','城堡'],
  困難: ['尷尬','自由','重力','回憶','網路','創意','時間旅行','人工智慧','量子','焦慮','通貨膨脹','元宇宙','薛丁格的貓','社畜','報復性消費'],
};

// ---- 房間狀態 ----
const rooms = {}; // roomId -> room

function makeRoom(roomId) {
  return {
    id: roomId,
    players: {}, // socketId -> {id,name,score,connected}
    order: [],   // 畫家輪流順序 (socketId)
    customWords: [], // 自訂詞
    difficulty: '普通',
    state: 'lobby', // lobby | choosing | drawing | reveal
    drawerId: null,
    drawerIndex: -1,
    word: null,
    wordChoices: [],
    roundEndsAt: null,
    roundLength: 80, // 秒
    timer: null,
    guessedThisRound: {}, // socketId -> true
    hostId: null,
    roundNo: 0,
    maxRounds: 99,
    strokes: [], // 畫布歷史 (給中途加入的人)
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    state: room.state,
    drawerId: room.drawerId,
    difficulty: room.difficulty,
    roundEndsAt: room.roundEndsAt,
    roundNo: room.roundNo,
    hostId: room.hostId,
    customWordsCount: room.customWords.length,
    players: room.order
      .map((id) => room.players[id])
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected,
        isDrawer: p.id === room.drawerId, guessed: !!room.guessedThisRound[p.id] })),
  };
}

function broadcast(room) {
  io.to(room.id).emit('room', publicRoom(room));
}

function wordPool(room) {
  const base = DEFAULT_WORDS[room.difficulty] || [];
  return [...base, ...room.customWords];
}

function pickWords(room, n = 4) {
  const pool = [...wordPool(room)];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function maskedWord(word) {
  // 給猜題者看的提示: 顯示字數
  if (!word) return '';
  return word.replace(/\S/g, '＿').split('').join(' ');
}

function clearRoundTimer(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
}

function nextDrawer(room) {
  const connectedIds = room.order.filter((id) => room.players[id] && room.players[id].connected);
  if (connectedIds.length < 2) {
    room.state = 'lobby';
    room.drawerId = null;
    room.word = null;
    broadcast(room);
    io.to(room.id).emit('system', { msg: '至少要 2 個人才能開始,先揪人吧。' });
    return;
  }
  room.drawerIndex = (room.drawerIndex + 1) % room.order.length;
  // 找到下一個還在線的人
  let guard = 0;
  while ((!room.players[room.order[room.drawerIndex]] ||
          !room.players[room.order[room.drawerIndex]].connected) && guard < room.order.length) {
    room.drawerIndex = (room.drawerIndex + 1) % room.order.length;
    guard++;
  }
  room.drawerId = room.order[room.drawerIndex];
  room.roundNo += 1;
  room.state = 'choosing';
  room.word = null;
  room.wordChoices = pickWords(room, 4);
  room.guessedThisRound = {};
  room.strokes = [];
  io.to(room.id).emit('clearCanvas');
  broadcast(room);

  // 只給畫家選詞選項
  io.to(room.drawerId).emit('chooseWord', { choices: room.wordChoices });
  io.to(room.id).emit('system', {
    msg: `輪到 ${room.players[room.drawerId].name} 出題畫圖!`,
  });

  // 畫家 15 秒沒選就自動選第一個
  clearRoundTimer(room);
  let countdown = 15;
  room.timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearRoundTimer(room);
      if (room.state === 'choosing') startDrawing(room, room.wordChoices[0]);
    }
  }, 1000);
}

function startDrawing(room, word) {
  clearRoundTimer(room);
  room.word = word;
  room.state = 'drawing';
  room.roundEndsAt = Date.now() + room.roundLength * 1000;
  broadcast(room);

  io.to(room.drawerId).emit('yourWord', { word });
  io.to(room.id).emit('roundStart', {
    masked: maskedWord(word),
    length: word.length,
    endsAt: room.roundEndsAt,
  });

  clearRoundTimer(room);
  room.timer = setInterval(() => {
    const left = Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
    io.to(room.id).emit('tick', { left });
    if (left <= 0) endRound(room, 'timeup');
  }, 1000);
}

function everyoneGuessed(room) {
  const guessers = room.order.filter(
    (id) => room.players[id] && room.players[id].connected && id !== room.drawerId
  );
  return guessers.length > 0 && guessers.every((id) => room.guessedThisRound[id]);
}

function endRound(room, reason) {
  clearRoundTimer(room);
  room.state = 'reveal';
  room.advancing = false; // 是否已開始換下一局(防重複)
  const revealedWord = room.word;
  broadcast(room);
  io.to(room.id).emit('roundEnd', {
    word: revealedWord,
    reason,
    scores: room.order.map((id) => room.players[id]).filter(Boolean)
      .map((p) => ({ name: p.name, score: p.score })),
  });
  // 最多等 6 秒自動換,期間任何人可按「下一局」提前換
  room.revealTimer = setTimeout(() => advanceRound(room), 6000);
}

// 換到下一局(手動或自動都走這裡,確保只換一次)
function advanceRound(room) {
  if (!rooms[room.id] || room.state !== 'reveal' || room.advancing) return;
  room.advancing = true;
  if (room.revealTimer) { clearTimeout(room.revealTimer); room.revealTimer = null; }
  nextDrawer(room);
}

io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('join', ({ roomId, name }) => {
    roomId = (roomId || 'lobby').trim().toLowerCase();
    name = (name || '無名氏').trim().slice(0, 16) || '無名氏';
    if (!rooms[roomId]) rooms[roomId] = makeRoom(roomId);
    const room = rooms[roomId];
    joinedRoom = room;
    socket.join(roomId);

    room.players[socket.id] = { id: socket.id, name, score: 0, connected: true };
    if (!room.order.includes(socket.id)) room.order.push(socket.id);
    if (!room.hostId) room.hostId = socket.id;

    socket.emit('joined', { roomId, youId: socket.id, hostId: room.hostId });
    // 補送目前畫布給中途加入者
    if (room.strokes.length) socket.emit('canvasHistory', room.strokes);
    if (room.state === 'drawing') {
      socket.emit('roundStart', {
        masked: maskedWord(room.word),
        length: room.word.length,
        endsAt: room.roundEndsAt,
      });
    }
    broadcast(room);
    io.to(room.id).emit('system', { msg: `${name} 加入了房間 👋` });
  });

  socket.on('start', () => {
    const room = joinedRoom;
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== 'lobby' && room.state !== 'reveal') return;
    room.roundNo = 0;
    room.drawerIndex = -1;
    Object.values(room.players).forEach((p) => (p.score = 0));
    nextDrawer(room);
  });

  socket.on('chooseWord', ({ word }) => {
    const room = joinedRoom;
    if (!room || room.state !== 'choosing' || socket.id !== room.drawerId) return;
    if (!room.wordChoices.includes(word)) return;
    startDrawing(room, word);
  });

  // 任何人在結算畫面按「下一局」可提前換局
  socket.on('nextRound', () => {
    const room = joinedRoom;
    if (!room || room.state !== 'reveal') return;
    advanceRound(room);
  });

  // 畫家不喜歡這批詞,重抽一次
  socket.on('rerollWords', () => {
    const room = joinedRoom;
    if (!room || room.state !== 'choosing' || socket.id !== room.drawerId) return;
    room.wordChoices = pickWords(room, 4);
    io.to(room.drawerId).emit('chooseWord', { choices: room.wordChoices });
  });

  socket.on('setDifficulty', ({ difficulty }) => {
    const room = joinedRoom;
    if (!room || room.hostId !== socket.id) return;
    if (DEFAULT_WORDS[difficulty]) { room.difficulty = difficulty; broadcast(room); }
  });

  socket.on('addWords', ({ words }) => {
    const room = joinedRoom;
    if (!room) return;
    const list = String(words || '')
      .split(/[\n,，、]/).map((w) => w.trim()).filter(Boolean).slice(0, 200);
    let added = 0;
    list.forEach((w) => {
      if (!room.customWords.includes(w)) { room.customWords.push(w); added++; }
    });
    broadcast(room);
    socket.emit('system', { msg: `加了 ${added} 個自訂詞,現在共 ${room.customWords.length} 個。` });
  });

  // ---- 畫圖事件 ----
  // 單筆(目前只用於填色指令)
  socket.on('draw', (data) => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId || room.state !== 'drawing') return;
    room.strokes.push(data);
    socket.to(room.id).emit('draw', data);
  });
  // 批次線條:一次收一串,存進歷史並原封廣播
  socket.on('drawBatch', (arr) => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId || room.state !== 'drawing') return;
    if (!Array.isArray(arr) || !arr.length) return;
    if (arr.length > 500) arr = arr.slice(0, 500); // 防爆量
    for (const d of arr) room.strokes.push(d);
    socket.to(room.id).emit('drawBatch', arr);
  });
  socket.on('clearCanvas', () => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId) return;
    room.strokes = [];
    io.to(room.id).emit('clearCanvas');
  });
  socket.on('undo', () => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId) return;
    // 移除最後一筆 (到上一個 strokeStart)
    let i = room.strokes.length - 1;
    while (i >= 0 && !room.strokes[i].start) i--;
    if (i >= 0) room.strokes = room.strokes.slice(0, i);
    io.to(room.id).emit('canvasHistory', room.strokes);
  });

  // ---- 猜題 / 聊天 ----
  socket.on('guess', ({ text }) => {
    const room = joinedRoom;
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    text = String(text || '').slice(0, 60);
    if (!text.trim()) return;

    const isDrawer = socket.id === room.drawerId;
    const canGuess = room.state === 'drawing' && !isDrawer && !room.guessedThisRound[socket.id];

    if (canGuess && room.word && normalize(text) === normalize(room.word)) {
      // 答對!
      room.guessedThisRound[socket.id] = true;
      const left = Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
      const gain = Math.max(10, Math.round(left / room.roundLength * 100) + 20);
      player.score += gain;
      // 畫家也得分 (每有人猜中 +15)
      if (room.players[room.drawerId]) room.players[room.drawerId].score += 15;

      io.to(room.id).emit('correct', { name: player.name, gain });
      broadcast(room);
      if (everyoneGuessed(room)) endRound(room, 'allguessed');
      return;
    }

    // 一般聊天 / 猜錯 (畫圖中且接近正確答案的字不直接顯示,避免暴雷就照常顯示)
    io.to(room.id).emit('chat', {
      name: player.name, text, isDrawer,
      guessed: !!room.guessedThisRound[socket.id],
    });
  });

  socket.on('disconnect', () => {
    const room = joinedRoom;
    if (!room || !room.players[socket.id]) return;
    const name = room.players[socket.id].name;
    room.players[socket.id].connected = false;
    io.to(room.id).emit('system', { msg: `${name} 離開了 👋` });

    // 換房主
    if (room.hostId === socket.id) {
      const next = room.order.find((id) => room.players[id] && room.players[id].connected);
      room.hostId = next || null;
    }
    // 如果是正在畫的人跑了,直接結束這回合
    if (room.drawerId === socket.id && (room.state === 'drawing' || room.state === 'choosing')) {
      io.to(room.id).emit('system', { msg: '畫家落跑了,跳下一題!' });
      endRound(room, 'drawer_left');
    } else {
      broadcast(room);
    }

    // 房間沒人就清掉
    const anyone = room.order.some((id) => room.players[id] && room.players[id].connected);
    if (!anyone) { clearRoundTimer(room); delete rooms[room.id]; }
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 詞庫匯出:/words/房號  -> 下載該房目前完整詞庫(內建+自訂)
app.get('/words/:room', (req, res) => {
  const id = String(req.params.room || '').trim().toLowerCase();
  const room = rooms[id];
  const data = {
    room: id,
    difficulty: room ? room.difficulty : null,
    builtin: DEFAULT_WORDS,
    custom: room ? room.customWords : [],
    exportedAt: new Date().toISOString(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="words-${id || 'default'}.json"`);
  res.json(data);
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`\n🎨 你畫我猜跑起來了 -> http://localhost:${PORT}\n`);
});
