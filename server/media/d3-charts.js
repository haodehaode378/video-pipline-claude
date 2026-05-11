import { JSDOM } from 'jsdom'
import * as d3 from 'd3'

const DEFAULT_PALETTE = ['#e94560', '#0f3460', '#16213e', '#533483', '#e1e1e1']

function createChartDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="chart"></div></body></html>')
  return { document: dom.window.document, window: dom.window }
}

function applyCommonSvg(svg, width, height, background) {
  return svg
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .style('background', background || 'transparent')
}

function generateBarChart(config) {
  const { data, width = 960, height = 540, palette = DEFAULT_PALETTE, background } = config
  const { document } = createChartDom()
  const body = d3.select(document.body)

  const svg = body.select('#chart').append('svg')
  applyCommonSvg(svg, width, height, background)

  const margin = { top: 60, right: 40, bottom: 80, left: 80 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerW]).padding(0.3)
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) * 1.1]).range([innerH, 0])

  g.append('g').call(d3.axisLeft(y).ticks(5)).attr('color', '#888')
  g.append('g').call(d3.axisBottom(x)).attr('transform', `translate(0,${innerH})`).attr('color', '#888')
    .selectAll('text').attr('transform', 'rotate(-20)').style('text-anchor', 'end')

  g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.label))
    .attr('y', (d) => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', (d) => innerH - y(d.value))
    .attr('fill', (_, i) => palette[i % palette.length])
    .attr('rx', 4)

  return body.select('#chart').html()
}

function generateLineChart(config) {
  const { data, width = 960, height = 540, palette = DEFAULT_PALETTE, background } = config
  const { document } = createChartDom()
  const body = d3.select(document.body)

  const svg = body.select('#chart').append('svg')
  applyCommonSvg(svg, width, height, background)

  const margin = { top: 60, right: 40, bottom: 80, left: 80 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scalePoint().domain(data.map((d) => d.label)).range([0, innerW])
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) * 1.1]).range([innerH, 0])

  g.append('g').call(d3.axisLeft(y).ticks(5)).attr('color', '#888')
  g.append('g').call(d3.axisBottom(x)).attr('transform', `translate(0,${innerH})`).attr('color', '#888')
    .selectAll('text').attr('transform', 'rotate(-20)').style('text-anchor', 'end')

  const line = d3.line().x((d) => x(d.label)).y((d) => y(d.value)).curve(d3.curveCatmullRom)

  g.append('path').datum(data).attr('fill', 'none').attr('stroke', palette[0])
    .attr('stroke-width', 3).attr('d', line)

  g.selectAll('.dot').data(data).join('circle').attr('cx', (d) => x(d.label))
    .attr('cy', (d) => y(d.value)).attr('r', 5).attr('fill', palette[0])

  return body.select('#chart').html()
}

function generatePieChart(config) {
  const { data, width = 960, height = 540, palette = DEFAULT_PALETTE, background, donut = false } = config
  const { document } = createChartDom()
  const body = d3.select(document.body)

  const svg = body.select('#chart').append('svg')
  applyCommonSvg(svg, width, height, background)

  const radius = Math.min(width, height) / 2 - 40
  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

  const pie = d3.pie().value((d) => d.value)
  const arc = d3.arc().innerRadius(donut ? radius * 0.6 : 0).outerRadius(radius)
  const color = d3.scaleOrdinal(palette)

  g.selectAll('path').data(pie(data)).join('path').attr('d', arc)
    .attr('fill', (_, i) => color(i)).attr('stroke', background || '#1a1a2e').attr('stroke-width', 3)

  g.selectAll('text').data(pie(data)).join('text').attr('transform', (d) => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 14)
    .text((d) => d.data.label)

  return body.select('#chart').html()
}

function generateDonutChart(config) {
  return generatePieChart({ ...config, donut: true })
}

const chartGenerators = {
  bar: generateBarChart,
  line: generateLineChart,
  pie: generatePieChart,
  donut: generateDonutChart,
}

export async function generateChart(config) {
  const { type = 'bar' } = config
  const generator = chartGenerators[type]
  if (!generator) throw new Error(`Unsupported chart type: ${type}. Supported: ${Object.keys(chartGenerators).join(', ')}`)
  return generator(config)
}

export function parseChartDescription(visualDescription) {
  const lower = visualDescription.toLowerCase()
  if (lower.includes('pie') || lower.includes('饼')) return 'pie'
  if (lower.includes('donut') || lower.includes('环形') || lower.includes('环')) return 'donut'
  if (lower.includes('line') || lower.includes('折线') || lower.includes('趋势')) return 'line'
  if (lower.includes('bar') || lower.includes('柱') || lower.includes('条')) return 'bar'
  return null
}

export const CHART_TYPES = Object.keys(chartGenerators)
