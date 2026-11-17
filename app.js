const $ = (selector) => document.querySelector(selector);
const rounds = [
  { name: 'Đón nhận ánh sáng', count: 6, points: [10] },
  { name: 'Hiệp bước trong ánh sáng', count: 9, points: [10, 20, 30] },
  { name: 'Giải mã ánh sáng', count: 12, points: [10] },
];
const key = 'cho-cau-scoreboard-2026-v1';
const projector = new URLSearchParams(location.search).has('trinh-chieu');
const initial = () => ({
  names: Array.from({ length: 9 }, (_, i) => 'Đội ' + (i + 1)),
  round: 0,
  entries: [],
  finalists: [],
});
function readState() {
  try {
    return JSON.parse(localStorage.getItem(key)) || initial();
  } catch {
    return initial();
  }
}
let state = readState();
let displayWindow;
let confirmAction;
let keyword = false;
let editingFinalists = false;
let finalistSignature = '';
let editingTeam;

function node(tag, className, content) {
  const item = document.createElement(tag);
  item.className = className;
  if (content !== undefined) item.textContent = content;
  return item;
}

function store(next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    return false;
  }
  state = next;
  if (displayWindow && !displayWindow.closed) displayWindow.postMessage({ key, state }, '*');
  return true;
}

function totals() {
  const teams = state.names.map((name, id) => ({ name, id, total: 0, scores: [0, 0, 0] }));
  for (const entry of state.entries) {
    if (entry.type === 'correction') {
      teams[entry.team].scores[entry.round] = entry.points;
      continue;
    }
    for (const id of entry.correct) {
      teams[id].scores[entry.round] += entry.points;
    }
  }
  for (const team of teams) team.total = team.scores.reduce((sum, points) => sum + points, 0);
  return teams.sort((a, b) => b.total - a.total || a.id - b.id);
}

function renderBoard(changed = []) {
  const board = $('#board');
  const finalistView = state.round === 2 && state.finalists.length === 4;
  const signature = finalistView ? state.finalists.join(',') : '';
  const shouldReveal = finalistView && signature !== finalistSignature &&
    board.childElementCount > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (shouldReveal) revealFinalists(board);
  if (!finalistView && finalistSignature) {
    board.parentElement.querySelector('.departing-grid')?.remove();
    board.parentElement.classList.remove('revealing');
  }
  finalistSignature = signature;
  board.replaceChildren();
  board.classList.toggle('final-grid', finalistView);
  $('#final-banner').hidden = !finalistView;
  const teams = totals().filter((team) => !finalistView || state.finalists.includes(team.id));
  const hasScores = teams.some((team) => team.total > 0);
  let rank = 1;
  const ranks = new Map();
  teams.forEach((team, index) => {
    if (index && teams[index - 1].total !== team.total) rank = index + 1;
    ranks.set(team.id, rank);
  });
  teams.sort((a, b) => a.id - b.id);
  for (const team of teams) {
    const rank = ranks.get(team.id);
    const card = node('li', 'team-card');
    card.dataset.team = team.id;
    if (rank === 1 && hasScores) card.classList.add('leader');
    if (changed.includes(team.id)) card.classList.add('score-change');
    const top = node('div', 'team-top');
    if (hasScores) {
      const badge = node('span', 'rank', rank);
      badge.setAttribute('aria-label', 'Hạng ' + rank);
      top.append(badge);
    }
    top.append(node('span', 'team-name', team.name));
    const score = node('div', 'team-score', team.total);
    score.append(node('span', '', 'điểm'));
    card.append(top, score);
    if (!projector) {
      const detail = node('div', 'team-detail');
      detail.append(node('span', '', team.scores.map((value, i) => 'V' + (i + 1) + ' ' + value).join(' · ')));
      const edit = node('button', 'text-button edit-team-score', 'Sửa điểm');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Sửa điểm · ' + team.name);
      edit.onclick = () => openScoreEditor(team.id);
      detail.append(edit);
      card.append(detail);
    }
    board.append(card);
  }
  $('#team-count').textContent = teams.length + ' đội';
  const audienceRound = $('#audience-round');
  audienceRound.textContent = 'Vòng ' + (state.round + 1) + ' · ' + rounds[state.round].name;
  if (finalistView) audienceRound.append(node('span', 'audience-final', ' · 4 đội vào vòng cuối'));
}

function openScoreEditor(id) {
  editingTeam = id;
  const select = $('#edit-score-round');
  select.replaceChildren(...rounds.map((round, index) => {
    const option = node('option', '', 'Vòng ' + (index + 1) + ' · ' + round.name);
    option.value = index;
    option.disabled = index === 2 && !state.finalists.includes(id);
    return option;
  }));
  select.value = select.options[state.round].disabled ? 1 : state.round;
  $('#edit-score-title').textContent = 'Sửa điểm · ' + state.names[id];
  updateScoreEditor();
  $('#edit-score').showModal();
  $('#edit-score-points').select();
}

function updateScoreEditor() {
  const team = totals().find((item) => item.id === editingTeam);
  $('#edit-score-points').value = team.scores[Number($('#edit-score-round').value)];
  $('#edit-score-status').textContent = '';
}

function revealFinalists(board) {
  const section = board.parentElement;
  section.querySelector('.departing-grid')?.remove();
  const previous = board.cloneNode(true);
  previous.removeAttribute('id');
  previous.classList.add('departing-grid');
  previous.setAttribute('aria-hidden', 'true');
  previous.inert = true;
  previous.style.top = board.offsetTop + 'px';
  previous.style.width = board.offsetWidth + 'px';
  previous.style.setProperty('--departing-height', board.offsetHeight + 'px');
  let eliminated = 0;
  for (const card of previous.children) {
    const keepsPlaying = state.finalists.includes(Number(card.dataset.team));
    card.classList.remove('score-change');
    card.classList.add(keepsPlaying ? 'stays' : 'departs');
    if (!keepsPlaying) card.style.setProperty('--delay', 155 * eliminated++ + 'ms');
  }
  section.append(previous);
  section.classList.remove('revealing');
  void section.offsetWidth;
  section.classList.add('revealing');
  window.setTimeout(() => {
    if (!previous.isConnected) return;
    previous.remove();
    section.classList.remove('revealing');
  }, 4200);
}

function questionNumber() {
  const used = new Set(state.entries.filter((entry) => entry.round === state.round).map((entry) => entry.number));
  for (let number = 1; number <= rounds[state.round].count; number++) {
    if (!used.has(number)) return number;
  }
  return null;
}

function chooseTeam(id, checked) {
  const label = node('label', 'choice');
  const input = node('input', '');
  input.type = 'checkbox';
  input.value = id;
  input.checked = checked;
  label.append(input, node('span', '', state.names[id]));
  return label;
}

function answerOption(id, value, labelText) {
  const label = node('label', 'choice ' + value);
  const input = node('input', '');
  input.type = 'radio';
  input.name = 'answer-' + id;
  input.value = value;
  input.setAttribute('aria-label', state.names[id] + ' · ' + labelText);
  label.append(input, node('span', '', labelText));
  return label;
}

function renderForm() {
  $('.edit-finalists')?.remove();
  const round = state.round;
  const rule = rounds[round];
  const selection = $('#qualification');
  const form = $('#score-form');
  const question = questionNumber();
  const canUseKeyword = round === 2 && !state.entries.some((entry) => entry.round === 2 && entry.number === 'keyword');
  if (!canUseKeyword) keyword = false;
  const needFinalists = round === 2 && (!state.finalists.length || editingFinalists);
  selection.hidden = !needFinalists;
  form.hidden = needFinalists;
  if (needFinalists) {
    const suggested = state.finalists.length ? state.finalists : totals().slice(0, 4).map((team) => team.id);
    $('#finalist-choices').replaceChildren(...state.names.map((_, id) => chooseTeam(id, suggested.includes(id))));
    return;
  }

  form.reset();
  const label = $('#question-label');
  label.textContent = keyword ? 'Từ khóa hàng dọc' : question ? 'Câu ' + question + ' / ' + rule.count : 'Đã chốt ' + rule.count + ' câu';
  if (round === 1 && question === null) {
    const advance = node('button', 'outline keyword-toggle', 'Chọn 4 đội đi tiếp');
    advance.type = 'button';
    advance.onclick = () => $('#rounds').children[2].click();
    label.append(advance);
  }
  if (canUseKeyword) {
    const toggle = node('button', 'outline keyword-toggle', keyword ? 'Về ô hàng ngang' : 'Chấm từ khóa');
    toggle.type = 'button';
    toggle.onclick = () => {
      keyword = !keyword;
      renderForm();
      $('#question-points').focus();
    };
    label.append(toggle);
  }
  if (round === 2 && !state.entries.some((entry) => entry.round === 2)) {
    const edit = node('button', 'text-button edit-finalists', 'Đổi đội vào vòng 3');
    edit.type = 'button';
    edit.onclick = () => {
      editingFinalists = true;
      renderForm();
      $('#finalist-choices input').focus();
    };
    label.before(edit);
  }
  const hasQuestion = keyword || question !== null;
  const pointInput = $('#question-points');
  pointInput.disabled = !hasQuestion;
  $('#answers').disabled = true;
  form.querySelector('button[type=submit]').disabled = !hasQuestion;
  $('#point-choices').replaceChildren();
  $('#team-choices').replaceChildren();
  $('#answers').hidden = !hasQuestion;
  pointInput.parentElement.hidden = !hasQuestion;
  if (!hasQuestion) return;

  const presets = keyword ? [50, 30, 20] : rule.points;
  for (const points of presets) {
    const button = node('button', 'outline point', points + ' đ');
    button.type = 'button';
    button.onclick = () => {
      pointInput.value = points;
      updateAnswers();
    };
    $('#point-choices').append(button);
  }
  const ids = round === 2 ? state.finalists : state.names.map((_, id) => id);
  for (const id of ids) {
    const row = node('div', 'answer-row');
    row.dataset.id = id;
    row.append(node('strong', '', state.names[id]), answerOption(id, 'correct', 'Đúng'), answerOption(id, 'wrong', 'Sai'));
    $('#team-choices').append(row);
  }
  const fill = node('button', 'text-button', 'Đánh Sai cho đội chưa chọn');
  fill.type = 'button';
  fill.onclick = () => {
    for (const row of answerRows()) {
      if (!row.querySelector(':checked')) row.querySelector('input[value=wrong]').checked = true;
    }
  };
  $('#team-choices').append(fill);
  updateAnswers();
}

function answerRows() {
  return [...document.querySelectorAll('.answer-row')];
}

function updateAnswers() {
  const points = $('#question-points');
  const ready = !!points.value && points.validity.valid;
  $('#answers').disabled = !ready;
  $('#score-form button[type=submit]').disabled = !ready;
}

function renderRounds() {
  const bar = $('#rounds');
  if (!bar.childElementCount) {
    rounds.forEach((round, index) => {
      const button = node('button', '');
      button.type = 'button';
      button.append(node('span', '', 'Vòng 0' + (index + 1)), round.name);
      button.onclick = () => {
        if (index === state.round) return;
        if (!store({ ...readState(), round: index })) {
          $('#status').textContent = 'Trình duyệt chưa lưu được thay đổi.';
          return;
        }
        keyword = false;
        editingFinalists = false;
        $('#status').textContent = '';
        render();
      };
      bar.append(button);
    });
  }
  [...bar.children].forEach((button, index) => button.setAttribute('aria-pressed', index === state.round));
}

function render(changed) {
  renderBoard(changed);
  if (!projector) {
    renderRounds();
    renderForm();
  }
}

function requestConfirm(title, message, action) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = message;
  confirmAction = action;
  $('#confirm').returnValue = 'cancel';
  $('#confirm').showModal();
}

function renderHistory() {
  const list = $('#history-list');
  list.replaceChildren();
  $('#reset').disabled = !state.entries.length && !state.finalists.length;
  if (!state.entries.length) list.append(node('p', '', 'Chưa có câu nào được chốt.'));
  for (const entry of [...state.entries].reverse()) {
    const row = node('div', 'entry');
    const detail = node('div', '');
    const correction = entry.type === 'correction';
    const title = correction ? 'Sửa điểm · ' + state.names[entry.team] :
      entry.number === 'keyword' ? 'Từ khóa' : 'Câu ' + entry.number;
    detail.append(node('strong', '', 'Vòng ' + (entry.round + 1) + ' · ' + title + ' · ' + entry.points + ' điểm'));
    if (correction) {
      detail.append(node('small', '', 'Điểm trước khi sửa: ' + entry.previous));
    } else {
      detail.append(node('small', '', 'Đúng: ' + (entry.correct.map((id) => state.names[id]).join(', ') || 'Không có đội') + ' · Sai: ' + (entry.wrong.map((id) => state.names[id]).join(', ') || 'Không có đội')));
    }
    const undo = node('button', 'outline', 'Hoàn tác');
    undo.type = 'button';
    undo.onclick = () => requestConfirm(correction ? 'Hoàn tác sửa điểm' : 'Hoàn tác ' + title.toLowerCase(),
      correction ? 'Điểm sẽ được tính lại từ các lần chấm và sửa còn lại.' : 'Kết quả câu này sẽ được gỡ và bạn có thể chấm lại.', () => {
      const current = readState();
      if (!store({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) })) {
        $('#history-status').textContent = 'Trình duyệt chưa lưu được thay đổi.';
        return;
      }
      render();
      renderHistory();
      $('#history-status').textContent = 'Đã hoàn tác ' + title.toLowerCase() + '.';
    });
    row.append(detail, undo);
    list.append(row);
  }
}

if (projector) {
  document.body.classList.add('projector');
  window.opener?.postMessage({ key, ready: true }, '*');
  $('#fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $('#fullscreen').textContent = 'Dùng F11 để toàn màn hình';
    }
  };
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen').textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  });
} else {
  $('#edit-score-round').onchange = updateScoreEditor;
  $('#edit-score-form').onsubmit = (event) => {
    event.preventDefault();
    const current = readState();
    const round = Number($('#edit-score-round').value);
    const points = $('#edit-score-points').valueAsNumber;
    if (round === 2 && !current.finalists.includes(editingTeam)) {
      $('#edit-score-status').textContent = 'Đội này chưa vào vòng 3.';
      return;
    }
    state = current;
    const previous = totals().find((team) => team.id === editingTeam).scores[round];
    if (previous === points) {
      $('#edit-score').close();
      return;
    }
    const entry = {
      id: crypto.randomUUID?.() || String(Date.now()),
      type: 'correction',
      team: editingTeam,
      round,
      previous,
      points,
    };
    if (!store({ ...current, entries: [...current.entries, entry] })) {
      $('#edit-score-status').textContent = 'Trình duyệt chưa lưu được điểm. Vui lòng thử lại.';
      return;
    }
    $('#edit-score').close();
    renderBoard([editingTeam]);
    if (state.round === 2 && !state.finalists.length) renderForm();
    $(`#board [data-team="${editingTeam}"] .edit-team-score`)?.focus({ preventScroll: true });
    $('#status').textContent = 'Đã lưu điểm mới cho ' + state.names[editingTeam] + '.';
  };
  $('#present').onclick = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.currentTarget;
    displayWindow = window.open(link.href, link.target, 'popup,width=1200,height=800');
    if (displayWindow) {
      event.preventDefault();
      displayWindow.focus();
    }
  };
  $('#question-points').addEventListener('input', updateAnswers);
  $('#score-form').onsubmit = (event) => {
    event.preventDefault();
    const rows = answerRows();
    const incomplete = rows.find((row) => !row.querySelector(':checked'));
    if (incomplete) {
      $('#status').textContent = 'Chọn Đúng hoặc Sai cho ' + state.names[Number(incomplete.dataset.id)] + '.';
      incomplete.querySelector('input').focus();
      return;
    }
    const round = state.round;
    const number = keyword ? 'keyword' : questionNumber();
    const points = $('#question-points').valueAsNumber;
    const current = readState();
    if (current.round !== round || !number || current.entries.some((entry) => entry.round === round && entry.number === number)) {
      state = current;
      render();
      $('#status').textContent = 'Bảng điểm đã thay đổi. Vui lòng kiểm tra câu hiện tại.';
      return;
    }
    const correct = [];
    const wrong = [];
    for (const row of rows) {
      (row.querySelector(':checked').value === 'correct' ? correct : wrong).push(Number(row.dataset.id));
    }
    const entry = { id: crypto.randomUUID?.() || String(Date.now()), round, number, points, correct, wrong };
    if (!store({ ...current, entries: [...current.entries, entry] })) {
      $('#status').textContent = 'Trình duyệt chưa lưu được điểm. Kiểm tra cài đặt lưu dữ liệu rồi thử lại.';
      return;
    }
    keyword = false;
    render(correct);
    const title = number === 'keyword' ? 'từ khóa' : 'câu ' + number;
    $('#status').textContent = 'Đã chốt ' + title + '. ' + (correct.length ? correct.length + ' đội được cộng ' + points + ' điểm mỗi đội.' : 'Điểm các đội giữ nguyên.');
    $('#question-points').focus();
  };

  $('#confirm-finalists').onclick = () => {
    const ids = [...$('#finalist-choices').querySelectorAll(':checked')].map((input) => Number(input.value));
    if (ids.length !== 4) {
      $('#status').textContent = 'Hãy chọn đúng 4 đội.';
      return;
    }
    if (!store({ ...readState(), finalists: ids })) {
      $('#status').textContent = 'Trình duyệt chưa lưu được danh sách.';
      return;
    }
    editingFinalists = false;
    render();
    $('#status').textContent = 'Đã xác nhận 4 đội vào vòng cuối.';
    $('#question-points').focus();
  };

  $('#show-history').onclick = () => {
    $('#history-status').textContent = '';
    renderHistory();
    $('#history').showModal();
  };
  $('#reset').onclick = () => requestConfirm('Xoá toàn bộ điểm', 'Mọi câu đã chấm và danh sách đội vào vòng 3 sẽ bị xoá. Tên các đội được giữ lại.', () => {
    if (!store({ ...initial(), names: readState().names })) {
      $('#history-status').textContent = 'Trình duyệt chưa lưu được thay đổi.';
      return;
    }
    keyword = false;
    render();
    renderHistory();
    $('#history-status').textContent = 'Đã xoá toàn bộ điểm.';
    $('#status').textContent = '';
  });
  $('#confirm').addEventListener('close', () => {
    if ($('#confirm').returnValue === 'yes') confirmAction?.();
    confirmAction = null;
  });

  $('#show-teams').onclick = () => {
    $('#team-fields').replaceChildren(...state.names.map((name, index) => {
      const label = node('label', '', 'Đội ' + (index + 1));
      const field = node('input', '');
      field.value = name;
      field.maxLength = 32;
      field.required = true;
      label.append(field);
      return label;
    }));
    $('#teams').showModal();
  };
  $('#team-form').onsubmit = (event) => {
    event.preventDefault();
    const fields = [...$('#team-fields').querySelectorAll('input')];
    const names = fields.map((field, index) => field.value.trim() || 'Đội ' + (index + 1));
    if (!store({ ...readState(), names })) {
      fields[0].setCustomValidity('Trình duyệt chưa lưu được tên đội.');
      fields[0].reportValidity();
      fields[0].setCustomValidity('');
      return;
    }
    $('#teams').close();
    render();
  };
  for (const button of document.querySelectorAll('[data-close]')) {
    button.onclick = () => button.closest('dialog').close();
  }
}

window.addEventListener('storage', (event) => {
  if (event.key === key) {
    state = readState();
    render();
    if ($('#history').open) renderHistory();
  }
});
window.addEventListener('message', (event) => {
  if (event.data?.key !== key) return;
  if (projector && event.source === window.opener && event.data.state) {
    state = event.data.state;
    renderBoard();
  }
  if (!projector && event.source === displayWindow && event.data.ready) {
    displayWindow.postMessage({ key, state }, '*');
  }
});
render();
