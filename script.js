const state = {
  currentScene: 0,
  metric: 'cases',
  topN: 15,
  selectedState: 'Texas',
  rows: [],
};

const scenes = [
  {
    text: 'Scene 1: A few states reported much larger college COVID case totals than the rest of the country.',
    title: 'Top States by Reported College COVID Cases',
    subtitle:
      'Use the measure buttons to compare total reported cases with the 2021-only cases.',
    draw: drawStateScene,
  },
  {
    text: 'Scene 2: The same uneven pattern appears at the school level. A small number of colleges reported far more cases than most others.',
    title: 'Top Colleges by Reported COVID Cases',
    subtitle:
      'Use the measure buttons to compare total reported cases with the 2021-only cases. Use the Top N menu to change how many schools are shown.',
    draw: drawCollegeScene,
  },
  {
    text: 'Scene 3: Choose a state to see whether its total is driven by one leading college or spread across several schools.',
    title: 'Top Colleges Inside One State',
    subtitle: 'Choose a state to compare colleges inside that state.',
    draw: drawStateDetailScene,
  },
];

const metricLabels = {
  cases: 'Total cases',
  cases_2021: '2021 cases',
};

const chart = d3.select('#chart');
const tooltip = d3.select('#tooltip');
const formatNumber = d3.format(',');

function cleanNumber(value) {
  const n = +value;
  return Number.isFinite(n) ? n : 0;
}

function truncate(text, maxLength = 34) {
  if (!text) return 'Unknown';
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function sumByGroup(rows, keyField, metric) {
  return Array.from(
    d3.rollup(
      rows,
      (group) => d3.sum(group, (d) => d[metric]),
      (d) => d[keyField]
    ),
    ([name, value]) => ({ name, value })
  ).filter((d) => d.name && d.value > 0);
}

function collegeRows(rows, metric) {
  return rows
    .filter((d) => d.college && d[metric] > 0)
    .map((d) => ({
      name: d.college,
      fullName: d.college,
      state: d.state,
      city: d.city,
      county: d.county,
      cases: d.cases,
      cases_2021: d.cases_2021,
      value: d[metric],
    }));
}

function sortDescending(rows) {
  return rows.sort((a, b) => d3.descending(a.value, b.value));
}

function setScene(index) {
  state.currentScene = Math.max(0, Math.min(index, scenes.length - 1));
  render();
}

function render() {
  const scene = scenes[state.currentScene];

  d3.select('#sceneCount').text(
    `Scene ${state.currentScene + 1} of ${scenes.length}`
  );
  d3.select('#sceneText').html(
    `<strong>${scene.text.split(':')[0]}:</strong>${scene.text.slice(
      scene.text.indexOf(':') + 1
    )}`
  );
  d3.select('#chartTitle').text(scene.title);
  d3.select('#chartSubtitle').text(scene.subtitle);

  d3.select('#backBtn').property('disabled', state.currentScene === 0);
  d3.select('#nextBtn').property(
    'disabled',
    state.currentScene === scenes.length - 1
  );

  d3.selectAll('.dot').classed('active', (d, i) => i === state.currentScene);

  buildControls();
  scene.draw();
}

function buildControls() {
  const controls = d3.select('#controls');
  controls.html('');

  const metricGroup = controls.append('div').attr('class', 'control-group');
  metricGroup.append('span').attr('class', 'control-label').text('Measure:');

  ['cases', 'cases_2021'].forEach((metric) => {
    metricGroup
      .append('button')
      .attr('class', `control-btn ${state.metric === metric ? 'active' : ''}`)
      .text(metricLabels[metric])
      .on('click', () => {
        state.metric = metric;
        render();
      });
  });

  if (state.currentScene === 1) {
    const topGroup = controls.append('div').attr('class', 'control-group');
    topGroup
      .append('label')
      .attr('for', 'topN')
      .attr('class', 'control-label')
      .text('Show:');

    const select = topGroup
      .append('select')
      .attr('id', 'topN')
      .on('change', (event) => {
        state.topN = +event.target.value;
        render();
      });

    [10, 15, 20].forEach((n) => {
      select
        .append('option')
        .attr('value', n)
        .property('selected', state.topN === n)
        .text(`Top ${n}`);
    });
  }

  if (state.currentScene === 2) {
    const stateGroup = controls.append('div').attr('class', 'control-group');
    stateGroup
      .append('label')
      .attr('for', 'stateSelect')
      .attr('class', 'control-label')
      .text('State:');

    const states = Array.from(
      new Set(state.rows.map((d) => d.state).filter(Boolean))
    ).sort(d3.ascending);
    const select = stateGroup
      .append('select')
      .attr('id', 'stateSelect')
      .on('change', (event) => {
        state.selectedState = event.target.value;
        render();
      });

    states.forEach((name) => {
      select
        .append('option')
        .attr('value', name)
        .property('selected', state.selectedState === name)
        .text(name);
    });
  }
}

function drawStateScene() {
  const data = sortDescending(
    sumByGroup(state.rows, 'state', state.metric)
  ).slice(0, 12);
  const total = d3.sum(state.rows, (d) => d[state.metric]);
  const top = data[0];
  const share = total > 0 ? Math.round((top.value / total) * 100) : 0;

  renderBarChart({
    data,
    labelMaxLength: 26,
    leftMargin: 180,
    xLabel: metricLabels[state.metric],
    annotation: `${top.name} is the highest state, with about ${share}% of the selected national total.`,
    tooltipHtml: (d) => `
      <strong>${d.name}</strong><br/>
      ${metricLabels[state.metric]}: ${formatNumber(d.value)}
    `,
  });
}

function drawCollegeScene() {
  const data = sortDescending(collegeRows(state.rows, state.metric)).slice(
    0,
    state.topN
  );
  const top = data[0];
  const second = data[1];
  const gap = second ? top.value - second.value : 0;

  renderBarChart({
    data,
    labelMaxLength: 33,
    leftMargin: 285,
    xLabel: metricLabels[state.metric],
    annotation: `${top.name} leads this list by ${formatNumber(gap)} ${
      state.metric === 'cases' ? 'cases' : 'cases in 2021'
    }.`,
    tooltipHtml: (d) => `
      <strong>${d.fullName}</strong><br/>
      ${d.city || 'Unknown city'}, ${d.state || 'Unknown state'}<br/>
      Total cases: ${formatNumber(d.cases)}<br/>
      2021 cases: ${formatNumber(d.cases_2021)}
    `,
  });
}

function drawStateDetailScene() {
  const selectedRows = state.rows.filter(
    (d) => d.state === state.selectedState
  );
  const data = sortDescending(collegeRows(selectedRows, state.metric)).slice(
    0,
    12
  );
  const stateTotal = d3.sum(selectedRows, (d) => d[state.metric]);
  const top = data[0];
  const share =
    top && stateTotal > 0 ? Math.round((top.value / stateTotal) * 100) : 0;

  renderBarChart({
    data,
    labelMaxLength: 33,
    leftMargin: 285,
    xLabel: metricLabels[state.metric],
    emptyText: `No ${metricLabels[
      state.metric
    ].toLowerCase()} are available for ${state.selectedState}.`,
    annotation: top
      ? `${top.name} accounts for about ${share}% of ${state.selectedState}'s all reported college cases.`
      : `No available bars for ${state.selectedState}.`,
    tooltipHtml: (d) => `
      <strong>${d.fullName}</strong><br/>
      ${d.city || 'Unknown city'}, ${d.state || 'Unknown state'}<br/>
      Total cases: ${formatNumber(d.cases)}<br/>
      2021 cases: ${formatNumber(d.cases_2021)}
    `,
  });
}

function renderBarChart(options) {
  const data = options.data;
  const width = 1120;
  const rowHeight = 35;
  const height = Math.max(430, 95 + data.length * rowHeight);
  const margin = {
    top: 22,
    right: 300,
    bottom: 64,
    left: options.leftMargin,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  chart.html('');
  const svg = chart
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  if (!data.length) {
    svg
      .append('text')
      .attr('class', 'empty-message')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .text(options.emptyText || 'No data available.');
    return;
  }

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) * 1.02])
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([0, innerHeight])
    .padding(0.18);

  const plot = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  plot
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(''));

  plot
    .append('g')
    .attr('class', 'axis')
    .call(
      d3.axisLeft(y).tickFormat((d) => truncate(d, options.labelMaxLength))
    );

  plot
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(',')));

  plot
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 48)
    .attr('text-anchor', 'middle')
    .text(options.xLabel);

  plot
    .selectAll('rect.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('y', (d) => y(d.name))
    .attr('width', (d) => x(d.value))
    .attr('height', y.bandwidth())
    .attr('fill', (d, i) => (i === 0 ? 'var(--highlight)' : 'var(--bar)'))
    .on('mousemove', (event, d) => showTooltip(event, options.tooltipHtml(d)))
    .on('mouseleave', hideTooltip);

  plot
    .selectAll('text.value-label')
    .data(data)
    .join('text')
    .attr('class', 'value-label')
    .attr('x', (d) => Math.min(x(d.value) + 8, innerWidth + 42))
    .attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4)
    .text((d) => formatNumber(d.value));

  drawAnnotation(svg, data[0], x, y, margin, innerWidth, options.annotation);
}

function drawAnnotation(svg, highlighted, x, y, margin, innerWidth, text) {
  const boxWidth = 235;
  const boxHeight = 74;
  const dotX = margin.left + x(highlighted.value);
  const dotY = margin.top + y(highlighted.name) + y.bandwidth() / 2;
  const boxX = margin.left + innerWidth + 62;
  const boxY = Math.max(12, dotY - boxHeight / 2);

  svg
    .append('circle')
    .attr('class', 'annotation-dot')
    .attr('cx', dotX)
    .attr('cy', dotY)
    .attr('r', 5);

  svg
    .append('line')
    .attr('class', 'annotation-line')
    .attr('x1', dotX + 6)
    .attr('y1', dotY)
    .attr('x2', boxX)
    .attr('y2', boxY + boxHeight / 2);

  svg
    .append('rect')
    .attr('class', 'annotation-box')
    .attr('x', boxX)
    .attr('y', boxY)
    .attr('width', boxWidth)
    .attr('height', boxHeight)
    .attr('rx', 8);

  const textGroup = svg
    .append('text')
    .attr('class', 'annotation-text')
    .attr('x', boxX + 14)
    .attr('y', boxY + 22);

  wrapText(textGroup, text, boxWidth - 28, 17);
}

function wrapText(textSelection, text, maxWidth, lineHeight) {
  const words = text.split(/\s+/).reverse();
  let line = [];
  let word;
  let lineNumber = 0;
  const x = +textSelection.attr('x');
  const y = +textSelection.attr('y');
  let tspan = textSelection.append('tspan').attr('x', x).attr('y', y);

  while ((word = words.pop())) {
    line.push(word);
    tspan.text(line.join(' '));
    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(' '));
      line = [word];
      tspan = textSelection
        .append('tspan')
        .attr('x', x)
        .attr('y', y)
        .attr('dy', `${++lineNumber * lineHeight}px`)
        .text(word);
    }
  }
}

function showTooltip(event, html) {
  tooltip
    .style('display', 'block')
    .style('left', `${event.clientX + 14}px`)
    .style('top', `${event.clientY + 14}px`)
    .html(html);
}

function hideTooltip() {
  tooltip.style('display', 'none');
}

d3.select('#backBtn').on('click', () => setScene(state.currentScene - 1));
d3.select('#nextBtn').on('click', () => setScene(state.currentScene + 1));

d3.csv('colleges.csv')
  .then((rows) => {
    state.rows = rows.map((d) => ({
      date: d.date,
      state: d.state,
      county: d.county,
      city: d.city,
      college: d.college,
      cases: cleanNumber(d.cases),
      cases_2021: cleanNumber(d.cases_2021),
    }));

    const topState = sortDescending(
      sumByGroup(state.rows, 'state', 'cases')
    )[0];
    if (topState) state.selectedState = topState.name;

    render();
  })
  .catch((error) => {
    console.error(error);
    d3.select('#sceneText').text(
      'The data file could not be loaded. Run this project from a local server, not by double-clicking index.html.'
    );
  });
