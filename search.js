import { sample } from 'https://lsong.org/scripts/array.js';
import { ready } from 'https://lsong.org/scripts/dom/index.js';
import { query, encode } from 'https://lsong.org/scripts/query.js';
import { parse as parseMarkdown } from 'https://lsong.org/scripts/marked.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';
import { OpenAI } from 'https://lsong.org/chatgpt-demo/openai.js';

const {
  lang,
  model = 'qwen/qwen-2-7b-instruct:free',
} = query;

const apiKeys = [
  "086290c607e5420a5912536d219ced1f2b84327a94ca6ce0156983a5e11dee7f",
  "108d029e3b985ca7f1ded346cfc5474c8f73efaf18509699fbba951395a26307",
  "29382dc2ebd951d9ecaa425dcc746c3c5669e9a808461027f2f76c8a6dbc9ea9",
  "4227981450052530c0edf6418ce5596aa66ea93a3605d480366970c6111ea537",
  "5b588423b57a937c0aa6db21b5434634ed55ff3c7f51c528297e8d1f0a7b8dad",
  "63b40bfa60cf41afea3d6890a57df75d735f1a99fd7f4c02561cf1f6389901c9",
  "65fc4e4ac25c261d541938a01e5c981b1bcea9bda7f0dadd83e87c450153e2ea",
  "6d7fdc964cd7acb611747e995e4b965bdd662a90e3d165a64233f77eaadfc13d",
  "758e0717572c6edc458d2c0c79f210f6686e5e8faf414682c978888ea12c14bc",
  "7cb98894020c65079d0d0dc3f72142ac6b89e45c5a969cd086b1b3c40c94929a",
  "a8488b678076d25f2df9bc914d3121680cc334f07518b925d270660348024574",
  "b8be14c1f7135f45e18e1ee378beb65f7191c37831c97a46fe6d0cded46c5aa7",
  "d5bce776f8db8f28270eebf252ee5647e67634c8c29ff8cdac73cc2b15794b8b",
];

const openai = new OpenAI({
  api: "https://openrouter.ai/api/v1",
  apiKey: 'sk-or-v1-' + sample(apiKeys, 1),
});

// const response = await openai.createChatCompletion({
//   model,
//   messages: [{ role: 'user', content: 'Hello!' }],
//   stream: true,
// });
// for await (const part of response) {
//   const content = part.choices[0]?.delta?.content || '';
//   console.log(content);
// }

const search = async q => {
  if (!q) return;
  const response = await fetch(`https://api.lsong.org/search?q=${q}`);
  return response.json();
};

const Overview = ({ result }) => {
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');
  const generateSummary = async () => {
    const fulltext = result.organic_results?.reduce((fulltext, item, index) => {
      const text = [item.title, item.snippet, `id: #result-${index}`, item.link].join('\n');
      return `${fulltext}\n\n[${item.position}]. ${text}`;
    }, '');
    const questions = result.related_questions?.reduce((out, q, index) => {
      return [
        out,
        `id: #Q${index + 1}`,
        `Q: ${q.question}`,
        `A: ${q.snippet}`,
        `source: [${q.title}](${q.link})`
      ].join('\n');
    }, 'Related Questions:\n');
    setSummary('');
    const prompt = `Query: ${result.search_parameters.q}\nSearch Result: ${fulltext}\n\n${questions}`;
    const userMessage = { role: 'user', content: prompt };
    const systemMessage = {
      role: 'system',
      content: `
        As a search assistant, your task is to help the user understand the search results by providing a detailed summary. 
        Highlight the key points, relevant facts, and important information found in the search results. 
        When citing links, please use the format <sup>[[1](#result-0)]</sup>. 
        Additionally, offer insights and context where necessary to enhance the user's comprehension. 
        Please use ${lang || 'same language as the query'} and markdown in your response.`
    };
    console.log(prompt);
    const response = await openai.createChatCompletion({
      model,
      messages: [systemMessage, userMessage],
      stream: true,
    });
    for await (const chunk of response) {
      if (chunk.error && chunk.error.code != 0) {
        throw new Error(chunk.error.message);
      }
      const content = chunk.choices[0]?.delta?.content || '';
      setSummary(summary => summary + content);
    }
    setDone(true);
  };
  useEffect(() => {
    generateSummary();
  }, [result]);
  return [
    h('h2', null, "Overview"),
    h('p', { className: 'overview', dangerouslySetInnerHTML: { __html: parseMarkdown(summary) } }),
    done && h('form', { action: "https://lsong.org/chatgpt-demo", className: 'input-group width-full' }, [
      h('input', { name: "assistant", type: "hidden", value: summary }),
      h('input', { name: "user", className: "input input-block input-small", placeholder: "Continue with ChatGPT 🤖" }),
      h('button', { type: "submit", className: "button button-small" }, "Send"),
    ]),
  ];
};

const SearchForm = ({ onSearch }) => {
  const [q, setKeyword] = useState('');
  const handleSearch = e => {
    e.preventDefault();
    onSearch(q);
  };
  useEffect(() => {
    query.q && setKeyword(query.q);
    query.q && onSearch(query.q);
  }, []);
  return [
    h('h2', {}, 'Search'),
    h('form', { className: 'input-group width-full full-width', onSubmit: handleSearch }, [
      h('input', {
        value: q,
        name: 'q',
        type: 'search',
        autofocus: true,
        className: 'input input-block',
        action: 'search.html',
        placeholder: 'Type keyword to search',
        onChange: e => setKeyword(e.target.value),
      }),
      h('button', { type: 'submit', className: 'button button-primary' }, 'Search'),
    ])
  ];
};

const ResultList = ({ result }) => {
  return [
    h('h2', null, "Results"),
    h('ul', { className: 'search-results grid' }, result.organic_results?.map((item, index) =>
      h('li', { key: index, id: `result-${index}`, className: 'col-12' }, [
        item.favicon && h('img', { src: item.favicon, width: 16, height: 16 }),
        h('span', {}, item.displayed_link),
        h('a', { href: item.link }, item.title),
        h('p', null, item.snippet),
      ])
    ))
  ];
}

const RelatedSearches = ({ relatedSearches }) => {
  return [
    h('h2', null, 'Related Searches'),
    h('ul', { className: 'related-searches grid' }, relatedSearches?.map((item, index) =>
      h('li', { key: index, className: 'col-4 col-sm-6' },
        h('a', { href: `?q=${item.query}` }, item.query)
      )
    ))
  ];
};

const RelatedQuestions = ({ relatedQuestions }) => {
  return [
    h('h2', null, 'Related Questions'),
    h('ul', { className: 'related-questions grid' }, relatedQuestions?.map((item, index) =>
      h('li', { key: index, className: 'col-12', id: `Q${index + 1}` },
        h('a', { className: 'question' }, item.question),
        h('p', { className: 'answer' }, item.snippet),
        h('div', null, [
          item.source_logo && h('img', { src: item.source_logo, width: 16, height: 16 }),
          h('span', {}, item.displayed_link),
          h('a', { href: item.link, className: 'block' }, item.title),
        ]),
      )
    ))
  ];
};

const TopStories = ({ topStories }) => {
  return [
    h('h2', null, 'Top Stories'),
    h('ul', { className: 'top-stories grid' }, topStories.map((item, index) =>
      h('li', { key: index, className: 'flex flex-row col-12' }, [
        h('img', { style: `background-image: url(${item.thumbnail});` }),
        h('div', null, [
          h('a', { href: item.link, className: 'block' }, item.title),
          h('span', { className: 'block' }, item.source),
          h('time', null, item.date),
        ])
      ])
    ))
  ]
};

const App = () => {
  const [result, setResult] = useState({});
  const handleSearch = async q => {
    const loading = document.getElementById('loading');
    setResult({});
    loading.hidden = false;
    history.replaceState(null, null, '?' + encode({ ...query, q }));
    const data = await search(q);
    setResult(data);
    loading.hidden = true;
  };
  return [
    h(SearchForm, { onSearch: handleSearch }),
    result.organic_results && h(Overview, { result }),
    result.organic_results && h(ResultList, { result }),
    result.top_stories && h(TopStories, { topStories: result.top_stories }),
    result.related_questions && h(RelatedQuestions, { relatedQuestions: result.related_questions }),
    result.related_searches && h(RelatedSearches, { relatedSearches: result.related_searches }),
  ];
};

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});