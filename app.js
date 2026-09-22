function buildAnswer(question, matches) {
  if (!matches.length) {
    return {
      lead: 'I could not find a strong match yet.',
      body: ['Try a more specific question about your latest interests.'],
      cited: [],
    };
  }

  const topKeywords = [...new Set(
    matches
      .flatMap((match) => (match.text.match(/\b[a-z]{5,}\b/g) || []).map((word) => word.toLowerCase()))
      .filter((word) => !['about', 'there', 'would', 'could', 'these', 'those', 'their', 'still', 'think', 'when', 'what', 'have', 'been', 'with', 'lately', 'obsessed'].includes(word))
  )].slice(0, 3);

  const subject = topKeywords.length ? topKeywords.join(', ') : 'your deeper patterns';
  const lead = `You keep returning to the idea of ${subject}.`;
  const followups = [
    'The strongest signal is a recurring preference for calm structure, useful rituals, and systems that make attention easier to carry.',
    'Across your notes, the threads are about clarity, making work feel human, and designing interfaces or routines that reduce friction.',
    'It reads like a slow-moving fascination with tools and habits that help your thinking feel visible and intentional.'
  ];

  return { lead, body: followups, cited: matches };
}

function renderTrail(matches) {
  const trail = document.getElementById('trail');
  const nodes = [
    { label: 'Your question', type: 'question' },
    ...matches.map((match) => ({ label: match.sourceName, type: 'memory' })),
    { label: 'AI synthesis', type: 'synthesis' },
  ];

  const fragments = [];
  nodes.forEach((node, index) => {
    fragments.push(`<div class="trail-node ${index > 0 && index < nodes.length - 1 ? 'active' : ''}"><strong>${node.label}</strong></div>`);
    if (index < nodes.length - 1) {
      fragments.push('<div class="trail-arrow" aria-hidden="true"></div>');
    }
  });

  trail.innerHTML = `<div class="trail-graph">${fragments.join('')}</div>`;
}

function renderMemoryCards(matches) {
  const memoryList = document.getElementById('memory-list');
  if (!matches.length) {
    memoryList.innerHTML = '<p>No clear matches yet. Try a simpler prompt.</p>';
    return;
  }

  memoryList.innerHTML = matches
    .map((match, index) => `
      <article class="memory-card ${index === 0 ? 'active' : ''}" data-memory-id="${match.id}">
        <h3>${match.sourceName}</h3>
        <p>${match.text}</p>
      </article>
    `)
    .join('');

  document.querySelectorAll('.memory-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.memoryId;
      const answerSentences = document.querySelectorAll('.answer-sentence');
      answerSentences.forEach((sentence) => {
        sentence.classList.toggle('active', sentence.dataset.sourceId === id);
      });

      document.querySelectorAll('.memory-card').forEach((el) => {
        el.classList.toggle('active', el.dataset.memoryId === id);
      });
    });
  });
}

function renderAnswer(question, matches) {
  const answer = buildAnswer(question, matches);
  const answerEl = document.getElementById('answer');

  const sentenceMarkup = [
    `<span class="answer-sentence active" data-source-id="${matches[0]?.id || 'none'}">${answer.lead}</span>`,
    ...answer.body.map((sentence, index) => {
      const source = matches[index % Math.max(matches.length, 1)] || matches[0];
      return `<span class="answer-sentence" data-source-id="${source?.id || 'none'}">${sentence}</span>`;
    }),
  ].join(' ');

  answerEl.innerHTML = sentenceMarkup;

  document.querySelectorAll('.answer-sentence').forEach((sentence) => {
    sentence.addEventListener('click', () => {
      const id = sentence.dataset.sourceId;
      document.querySelectorAll('.memory-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.memoryId === id);
      });
      document.querySelectorAll('.answer-sentence').forEach((el) => {
        el.classList.toggle('active', el.dataset.sourceId === id);
      });
    });
  });
}

async function handleAsk(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return;
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(cleanQuestion)}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }

    const payload = await response.json();
    const matches = payload.matches || [];
    renderTrail(matches);
    renderMemoryCards(matches);
    renderAnswer(cleanQuestion, matches);
  } catch (error) {
    const answerEl = document.getElementById('answer');
    answerEl.innerHTML = '<span class="answer-sentence active">The local embedding search is unavailable right now. Please try again.</span>';
    document.getElementById('memory-list').innerHTML = '<p>Unable to load matched memories.</p>';
  }
}

async function init() {
  const questionInput = document.getElementById('question-input');
  const askButton = document.getElementById('ask-button');
  const demoButton = document.getElementById('demo-question');

  askButton.addEventListener('click', () => handleAsk(questionInput.value));
  questionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleAsk(questionInput.value);
    }
  });
  demoButton.addEventListener('click', () => {
    questionInput.value = 'What have I been obsessed with lately?';
    handleAsk(questionInput.value);
  });

  handleAsk(questionInput.value);
}

init();
