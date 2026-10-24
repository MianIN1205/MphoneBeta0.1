// 眠花糖机 — Chat — 「我的」界面（账号信息与多账号切换）

// =============================================
// Chat — 「我的」界面（账号信息与多账号切换）
// =============================================
(function() {
  var MINE_ACCOUNTS_KEY = 'mphone_mine_accounts_v1';
  var MINE_ACTIVE_KEY   = 'mphone_mine_active_idx_v1';

  var mineAvatarBox       = document.getElementById('mineAvatarBox');
  var mineDisplayNickname = document.getElementById('mineDisplayNickname');
  var mineDisplayId       = document.getElementById('mineDisplayId');
  var mineDisplayBio      = document.getElementById('mineDisplayBio');
  var mineEditBtn         = document.getElementById('mineEditBtn');
  var mineAccDrawer       = document.getElementById('mineAccDrawer');
  var mineSwitchAccBtn    = document.getElementById('mineSwitchAccBtn');
  var mineAccList         = document.getElementById('mineAccList');
  var mineEditOverlay     = document.getElementById('mineEditOverlay');
  var mineEditTitle       = document.getElementById('mineEditTitle');
  var mineNicknameInput   = document.getElementById('mineNicknameInput');
  var mineIdInput         = document.getElementById('mineIdInput');
  var mineBioInput        = document.getElementById('mineBioInput');
  var mineEditCancelBtn   = document.getElementById('mineEditCancelBtn');
  var mineEditSaveBtn     = document.getElementById('mineEditSaveBtn');

  var mineAccounts = [];
  var mineActiveIdx = 0;
  var mineEditMode = 'edit';   // 'edit' = 修改当前账号，'add' = 添加账号

  var PERSON_SVG = '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

  function nickOf(acc) {
    return (acc.nickname && acc.nickname.trim()) ? acc.nickname.trim() : '未设置昵称';
  }

  function loadMineAccounts() {
    var parsed = mphoneStore.load(MINE_ACCOUNTS_KEY, null);
    if (Array.isArray(parsed) && parsed.length > 0) mineAccounts = parsed;
    if (!mineAccounts.length) {
      mineAccounts = [
        { id: '@mphone_01', nickname: '默认账号', bio: '欢迎来到 Mphone，点击可随时修改你的个性签名～', avatar: '' }
      ];
    }
    // 旧数据「实名」字段迁移为「昵称」
    mineAccounts.forEach(function(acc) {
      if (acc.nickname === undefined) { acc.nickname = acc.realname || ''; delete acc.realname; }
      // uid：内部固定 id（账号 ID 可被用户修改，不能用来关联）
      if (!acc.uid) acc.uid = genAccountUid();
    });
    // 立即写回，保证 uid 固定、其他模块能读到默认账号
    mphoneStore.save(MINE_ACCOUNTS_KEY, mineAccounts);
    var savedIdx = parseInt(mphoneStore.load(MINE_ACTIVE_KEY, 0), 10);
    mineActiveIdx = (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < mineAccounts.length) ? savedIdx : 0;
  }

  function saveMineAccounts() {
    mphoneStore.save(MINE_ACCOUNTS_KEY, mineAccounts);
    mphoneStore.save(MINE_ACTIVE_KEY, mineActiveIdx);
  }

  function renderMinePanel() {
    var acc = mineAccounts[mineActiveIdx] || mineAccounts[0];
    if (!acc) return;
    mineDisplayNickname.textContent = nickOf(acc);
    mineDisplayId.textContent       = (acc.id && acc.id.trim()) ? acc.id.trim() : '@mphone';
    mineDisplayBio.textContent      = (acc.bio && acc.bio.trim()) ? acc.bio.trim() : '点击右上角修改你的专属个性签名…';

    if (acc.avatar) {
      mineAvatarBox.style.backgroundImage = 'url(' + acc.avatar + ')';
      mineAvatarBox.classList.add('has-img');
    } else {
      mineAvatarBox.style.backgroundImage = '';
      mineAvatarBox.classList.remove('has-img');
    }
    renderMineAccList();
    // 钱包 / 收藏在 19 号文件里，启动时它还没加载；它加载完会自己刷新一次
    if (typeof refreshMineEntries === 'function') refreshMineEntries();
  }

  mineAvatarBox.addEventListener('click', function() {
    openImgPicker(function(src) {
      var acc = mineAccounts[mineActiveIdx];
      if (!acc) return;
      acc.avatar = src;
      saveMineAccounts();
      renderMinePanel();
    });
  });

  // 抽屉列表：第一项「添加账号」，之后是当前账号以外的其他账号
  // 账号行点击不切换；向左滑动露出 登录 / 修改 / 删除
  var SWIPE_W = 132;          // 三个按钮总宽
  var openSwipe = null;       // 当前展开的那一行

  // 按钮组从右侧滑入（x 为 0 ~ -SWIPE_W）；账号内容不动，右侧留出按钮宽度让名字省略显示
  function setSwipe(row, x) {
    row.querySelector('.mine-acc-swipe-acts').style.transform = 'translateX(' + (SWIPE_W + x) + 'px)';
    row.querySelector('.mine-acc-front').style.paddingRight = (-x > 11 ? -x : 11) + 'px';
  }

  function closeSwipe(row) {
    if (!row) return;
    row.querySelector('.mine-acc-swipe-acts').style.transition = '';
    row.querySelector('.mine-acc-front').style.transition = '';
    setSwipe(row, 0);
    row.classList.remove('open');
    if (openSwipe === row) openSwipe = null;
  }

  function bindSwipe(row) {
    var front = row.querySelector('.mine-acc-front');
    var acts  = row.querySelector('.mine-acc-swipe-acts');
    var startX = 0, startY = 0, base = 0, dx = 0, dragging = false, decided = false;
    front.addEventListener('pointerdown', function(e) {
      startX = e.clientX; startY = e.clientY;
      base = row.classList.contains('open') ? -SWIPE_W : 0;
      dx = 0; dragging = true; decided = false;
      front.style.transition = acts.style.transition = 'none';
    });
    front.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      var mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        decided = true;
        // 竖向滑动交给列表滚动
        if (Math.abs(my) > Math.abs(mx)) { dragging = false; front.style.transition = acts.style.transition = ''; return; }
        try { front.setPointerCapture(e.pointerId); } catch (_) {}
        if (openSwipe && openSwipe !== row) closeSwipe(openSwipe);
      }
      dx = mx;
      setSwipe(row, Math.max(-SWIPE_W, Math.min(0, base + dx)));
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      front.style.transition = acts.style.transition = '';
      var x = Math.max(-SWIPE_W, Math.min(0, base + dx));
      if (x < -SWIPE_W / 2) {
        setSwipe(row, -SWIPE_W);
        row.classList.add('open');
        openSwipe = row;
      } else {
        closeSwipe(row);
      }
    }
    front.addEventListener('pointerup', end);
    front.addEventListener('pointercancel', end);
  }

  function renderMineAccList() {
    mineAccList.innerHTML = '';
    openSwipe = null;

    var addItem = document.createElement('div');
    addItem.className = 'mine-acc-item mine-acc-add-item';
    addItem.innerHTML = '<div class="mine-acc-item-av">+</div><div class="mine-acc-item-info"><div class="mine-acc-item-name">添加账号</div></div>';
    addItem.addEventListener('click', function() { openMineEdit('add'); });
    mineAccList.appendChild(addItem);

    mineAccounts.forEach(function(acc, idx) {
      if (idx === mineActiveIdx) return;
      var row = document.createElement('div');
      row.className = 'mine-acc-swipe';

      // 右侧操作按钮（滑动后露出）
      var acts = document.createElement('div');
      acts.className = 'mine-acc-swipe-acts';
      [['login', '登录'], ['edit', '修改'], ['delete', '删除']].forEach(function(a) {
        var b = document.createElement('button');
        b.className = 'mine-acc-swipe-btn swipe-' + a[0];
        b.textContent = a[1];
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          if (a[0] === 'login') loginAccount(idx);
          else if (a[0] === 'edit') { closeSwipe(row); openMineEdit('edit', idx); }
          else deleteAccount(idx);
        });
        acts.appendChild(b);
      });

      var item = document.createElement('div');
      item.className = 'mine-acc-item mine-acc-front';

      var av = document.createElement('div');
      av.className = 'mine-acc-item-av' + (acc.avatar ? ' has-img' : '');
      if (acc.avatar) av.style.backgroundImage = 'url(' + acc.avatar + ')';
      av.innerHTML = PERSON_SVG;

      var info = document.createElement('div');
      info.className = 'mine-acc-item-info';
      var nameEl = document.createElement('div');
      nameEl.className = 'mine-acc-item-name';
      nameEl.textContent = nickOf(acc);
      var subEl = document.createElement('div');
      subEl.className = 'mine-acc-item-sub';
      subEl.textContent = (acc.id && acc.id.trim()) ? acc.id.trim() : '@mphone';
      info.appendChild(nameEl);
      info.appendChild(subEl);

      var hint = document.createElement('span');
      hint.className = 'mine-acc-swipe-hint';
      hint.textContent = '‹ 左滑';

      item.appendChild(av);
      item.appendChild(info);
      item.appendChild(hint);
      row.appendChild(acts);
      row.appendChild(item);
      bindSwipe(row);
      mineAccList.appendChild(row);
    });
  }

  // 登录：设为主账号
  function loginAccount(idx) {
    var acc = mineAccounts[idx];
    mineActiveIdx = idx;
    saveMineAccounts();
    renderMinePanel();
    mineAccDrawer.classList.remove('open');
    showToast('✓ 已登录「' + nickOf(acc) + '」', 'success');
  }

  // 删除：确认后删除；单独使用这个账号的聊天恢复为跟随主账号
  function deleteAccount(idx) {
    var acc = mineAccounts[idx];
    openPfEntryDel('删除账号「' + nickOf(acc) + '」？使用它的聊天会恢复为主账号', function() {
      mineAccounts.splice(idx, 1);
      if (idx < mineActiveIdx) mineActiveIdx--;
      var changed = false;
      charList.forEach(function(c) {
        if (acc.uid && c.userAccountUid === acc.uid) { c.userAccountUid = ''; changed = true; }
      });
      if (changed) saveCharList();
      saveMineAccounts();
      renderMinePanel();
      showToast('已删除账号', 'success');
    });
  }

  mineSwitchAccBtn.addEventListener('click', function() {
    mineAccDrawer.classList.toggle('open');
  });

  // 修改资料 / 添加账号 弹窗
  // idx：要修改的账号（默认当前账号）
  var mineEditIdx = 0;
  function openMineEdit(mode, idx) {
    mineEditMode = mode;
    mineEditIdx = (typeof idx === 'number') ? idx : mineActiveIdx;
    var acc = mode === 'edit' ? mineAccounts[mineEditIdx] : null;
    mineEditTitle.textContent = mode === 'edit' ? '修改资料' : '添加账号';
    mineNicknameInput.value = acc ? (acc.nickname || '') : '';
    mineIdInput.value       = normalizeAccId(acc ? (acc.id || '') : 'mphone_' + pad(mineAccounts.length + 1));
    mineBioInput.value      = acc ? (acc.bio || '') : '';
    document.getElementById('minePersonaInput').value = acc ? (acc.persona || '') : '';
    mineEditOverlay.classList.add('open');
    mineNicknameInput.focus();
  }

  function closeMineEdit() { mineEditOverlay.classList.remove('open'); }

  mineEditBtn.addEventListener('click', function() { openMineEdit('edit'); });

  // 账号 ID：开头固定 @，后面只允许英文字母、数字和下划线
  function normalizeAccId(v) {
    return '@' + String(v || '').replace(/[^A-Za-z0-9_]/g, '');
  }
  mineIdInput.addEventListener('input', function() {
    var pos = this.selectionStart;
    var fixed = normalizeAccId(this.value);
    if (fixed !== this.value) {
      var diff = this.value.length - fixed.length;
      this.value = fixed;
      var p = Math.max(1, (pos || 1) - Math.max(0, diff));
      this.setSelectionRange(p, p);
    }
  });
  // 光标不能移到 @ 前面
  ['keydown', 'click', 'focus'].forEach(function(ev) {
    mineIdInput.addEventListener(ev, function(e) {
      if (ev === 'keydown' && (e.key === 'Backspace' || e.key === 'ArrowLeft' || e.key === 'Home') &&
          this.selectionStart <= 1 && this.selectionEnd <= 1) {
        e.preventDefault();
      }
      var self = this;
      setTimeout(function() {
        if (self.selectionStart < 1) self.setSelectionRange(1, Math.max(1, self.selectionEnd));
      }, 0);
    });
  });
  mineEditCancelBtn.addEventListener('click', closeMineEdit);
  mineEditOverlay.addEventListener('click', function(e) {
    if (e.target === mineEditOverlay) closeMineEdit();
  });

  mineEditSaveBtn.addEventListener('click', function() {
    var nickname = mineNicknameInput.value.trim();
    if (!nickname) {
      mineNicknameInput.classList.remove('shake');
      void mineNicknameInput.offsetWidth;
      mineNicknameInput.classList.add('shake');
      mineNicknameInput.addEventListener('animationend', function() {
        mineNicknameInput.classList.remove('shake');
      }, { once: true });
      return;
    }
    var accId = normalizeAccId(mineIdInput.value);
    if (accId === '@') { shakeEl(mineIdInput); return; }
    var data = {
      nickname: nickname, id: accId, bio: mineBioInput.value.trim(),
      persona: document.getElementById('minePersonaInput').value.trim()
    };
    if (mineEditMode === 'edit') {
      Object.assign(mineAccounts[mineEditIdx], data);
    } else {
      data.avatar = '';
      data.uid = genAccountUid();
      mineAccounts.push(data);
      showToast('✓ 已添加账号「' + nickname + '」', 'success');
    }
    saveMineAccounts();
    renderMinePanel();
    closeMineEdit();
  });

  loadMineAccounts();
  renderMinePanel();
})();
