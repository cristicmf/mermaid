import graphlib from 'graphlibrary'
import * as d3 from 'd3'

import flowDb from './flowDb'
import flow from './parser/flow'
import { getConfig } from '../../config'
import dagreD3 from 'dagre-d3-renderer'
import addHtmlLabel from 'dagre-d3-renderer/lib/label/add-html-label.js'
import { logger } from '../../logger'
import { interpolateToCurve } from '../../utils'

const conf = {
}
export const setConf = function (cnf) {
  const keys = Object.keys(cnf)
  for (let i = 0; i < keys.length; i++) {
    conf[keys[i]] = cnf[keys[i]]
  }
}

/**
 * Function that adds the vertices found in the graph definition to the graph to be rendered.
 * @param vert Object containing the vertices.
 * @param g The graph that is to be drawn.
 */
export const addVertices = function (vert, g, svgId) {
  const svg = d3.select(`[id="${svgId}"]`)
  const keys = Object.keys(vert)

  const styleFromStyleArr = function (styleStr, arr) {
    // Create a compound style definition from the style definitions found for the node in the graph definition
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== 'undefined') {
        styleStr = styleStr + arr[i] + ';'
      }
    }

    return styleStr
  }

  // Iterate through each item in the vertex object (containing all the vertices found) in the graph definition
  keys.forEach(function (id) {
    const vertex = vert[id]

    /**
     * Variable for storing the classes for the vertex
     * @type {string}
     */
    let classStr = ''
    if (vertex.classes.length > 0) {
      classStr = vertex.classes.join(' ')
    }

    /**
     * Variable for storing the extracted style for the vertex
     * @type {string}
     */
    let style = ''
    // Create a compound style definition from the style definitions found for the node in the graph definition
    style = styleFromStyleArr(style, vertex.styles)

    // Use vertex id as text in the box if no text is provided by the graph definition
    let vertexText = vertex.text !== undefined ? vertex.text : vertex.id

    // We create a SVG label, either by delegating to addHtmlLabel or manually
    let vertexNode
    if (getConfig().flowchart.htmlLabels) {
      // TODO: addHtmlLabel accepts a labelStyle. Do we possibly have that?
      const node = { label: vertexText.replace(/fa[lrsb]?:fa-[\w-]+/g, s => `<i class='${s.replace(':', ' ')}'></i>`) }
      vertexNode = addHtmlLabel(svg, node).node()
      vertexNode.parentNode.removeChild(vertexNode)
    } else {
      const svgLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')

      const rows = vertexText.split(/<br[/]{0,1}>/)

      for (let j = 0; j < rows.length; j++) {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        tspan.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
        tspan.setAttribute('dy', '1em')
        tspan.setAttribute('x', '1')
        tspan.textContent = rows[j]
        svgLabel.appendChild(tspan)
      }
      vertexNode = svgLabel
    }

    // If the node has a link, we wrap it in a SVG link
    if (vertex.link) {
      const link = document.createElementNS('http://www.w3.org/2000/svg', 'a')
      link.setAttributeNS('http://www.w3.org/2000/svg', 'href', vertex.link)
      link.setAttributeNS('http://www.w3.org/2000/svg', 'rel', 'noopener')
      link.appendChild(vertexNode)
      vertexNode = link
    }

    let radious = 0
    let _shape = ''
    // Set the shape based parameters
    switch (vertex.type) {
      case 'round':
        radious = 5
        _shape = 'rect'
        break
      case 'square':
        _shape = 'rect'
        break
      case 'diamond':
        _shape = 'question'
        break
      case 'odd':
        _shape = 'rect_left_inv_arrow'
        break
      case 'lean_right':
        _shape = 'lean_right'
        break
      case 'lean_left':
        _shape = 'lean_left'
        break
      case 'trapezoid':
        _shape = 'trapezoid'
        break
      case 'inv_trapezoid':
        _shape = 'inv_trapezoid'
        break
      case 'odd_right':
        _shape = 'rect_left_inv_arrow'
        break
      case 'circle':
        _shape = 'circle'
        break
      case 'ellipse':
        _shape = 'ellipse'
        break
      case 'group':
        _shape = 'rect'
        break
      default:
        _shape = 'rect'
    }
    // Add the node
    g.setNode(vertex.id, { labelType: 'svg', shape: _shape, label: vertexNode, rx: radious, ry: radious, 'class': classStr, style: style, id: vertex.id })
  })
}

/**
 * Add edges to graph based on parsed graph defninition
 * @param {Object} edges The edges to add to the graph
 * @param {Object} g The graph object
 */
export const addEdges = function (edges, g) {
  let cnt = 0

  let defaultStyle
  if (typeof edges.defaultStyle !== 'undefined') {
    defaultStyle = edges.defaultStyle.toString().replace(/,/g, ';')
  }

  edges.forEach(function (edge) {
    cnt++
    const edgeData = {}

    // Set link type for rendering
    if (edge.type === 'arrow_open') {
      edgeData.arrowhead = 'none'
    } else {
      edgeData.arrowhead = 'normal'
    }

    let style = ''
    if (typeof edge.style !== 'undefined') {
      edge.style.forEach(function (s) {
        style = style + s + ';'
      })
    } else {
      switch (edge.stroke) {
        case 'normal':
          style = 'fill:none'
          if (typeof defaultStyle !== 'undefined') {
            style = defaultStyle
          }
          break
        case 'dotted':
          style = 'stroke: #333; fill:none;stroke-width:2px;stroke-dasharray:3;'
          break
        case 'thick':
          style = 'stroke: #333; stroke-width: 3.5px;fill:none'
          break
      }
    }
    edgeData.style = style

    if (typeof edge.interpolate !== 'undefined') {
      edgeData.curve = interpolateToCurve(edge.interpolate, d3.curveLinear)
    } else if (typeof edges.defaultInterpolate !== 'undefined') {
      edgeData.curve = interpolateToCurve(edges.defaultInterpolate, d3.curveLinear)
    } else {
      edgeData.curve = interpolateToCurve(conf.curve, d3.curveLinear)
    }

    if (typeof edge.text === 'undefined') {
      if (typeof edge.style !== 'undefined') {
        edgeData.arrowheadStyle = 'fill: #333'
      }
    } else {
      edgeData.arrowheadStyle = 'fill: #333'
      if (typeof edge.style === 'undefined') {
        edgeData.labelpos = 'c'
        if (getConfig().flowchart.htmlLabels) {
          edgeData.labelType = 'html'
          edgeData.label = '<span class="edgeLabel">' + edge.text + '</span>'
        } else {
          edgeData.labelType = 'text'
          edgeData.style = edgeData.style || 'stroke: #333; stroke-width: 1.5px;fill:none'
          edgeData.label = edge.text.replace(/<br>/g, '\n')
        }
      } else {
        edgeData.label = edge.text.replace(/<br>/g, '\n')
      }
    }
    // Add the edge to the graph
    g.setEdge(edge.start, edge.end, edgeData, cnt)
  })
}

/**
 * Returns the all the styles from classDef statements in the graph definition.
 * @returns {object} classDef styles
 */
export const getClasses = function (text) {
  flowDb.clear()
  const parser = flow.parser
  parser.yy = flowDb

  // Parse the graph definition
  parser.parse(text)
  return flowDb.getClasses()
}

/**
 * Draws a flowchart in the tag with id: id based on the graph definition in text.
 * @param text
 * @param id
 */
export const draw = function (text, id) {
  logger.debug('Drawing flowchart')
  flowDb.clear()
  const parser = flow.parser
  parser.yy = flowDb

  // Parse the graph definition
  try {
    parser.parse(text)
  } catch (err) {
    logger.debug('Parsing failed')
  }

  // Fetch the default direction, use TD if none was found
  let dir = flowDb.getDirection()
  if (typeof dir === 'undefined') {
    dir = 'TD'
  }

  // Create the input mermaid.graph
  const g = new graphlib.Graph({
    multigraph: true,
    compound: true
  })
    .setGraph({
      rankdir: dir,
      marginx: 20,
      marginy: 20

    })
    .setDefaultEdgeLabel(function () {
      return {}
    })

  let subG
  const subGraphs = flowDb.getSubGraphs()
  for (let i = subGraphs.length - 1; i >= 0; i--) {
    subG = subGraphs[i]
    flowDb.addVertex(subG.id, subG.title, 'group', undefined, subG.classes)
  }

  // Fetch the verices/nodes and edges/links from the parsed graph definition
  const vert = flowDb.getVertices()

  const edges = flowDb.getEdges()

  let i = 0
  for (i = subGraphs.length - 1; i >= 0; i--) {
    subG = subGraphs[i]

    d3.selectAll('cluster').append('text')

    for (let j = 0; j < subG.nodes.length; j++) {
      g.setParent(subG.nodes[j], subG.id)
    }
  }
  addVertices(vert, g, id)
  addEdges(edges, g)

  // Create the renderer
  const Render = dagreD3.render
  const render = new Render()

  // Add custom shape for rhombus type of boc (decision)
  render.shapes().question = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const s = (w + h) * 0.9
    const points = [
      { x: s / 2, y: 0 },
      { x: s, y: -s / 2 },
      { x: s / 2, y: -s },
      { x: 0, y: -s / 2 }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('transform', 'translate(' + (-s / 2) + ',' + (s * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on left side
  render.shapes().rect_left_inv_arrow = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: -h / 2, y: 0 },
      { x: w, y: 0 },
      { x: w, y: -h },
      { x: -h / 2, y: -h },
      { x: 0, y: -h / 2 }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on left side
  render.shapes().lean_right = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: -2 * h / 6, y: 0 },
      { x: w - h / 6, y: 0 },
      { x: w + 2 * h / 6, y: -h },
      { x: h / 6, y: -h }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on left side
  render.shapes().lean_left = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: 2 * h / 6, y: 0 },
      { x: w + h / 6, y: 0 },
      { x: w - 2 * h / 6, y: -h },
      { x: -h / 6, y: -h }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on left side
  render.shapes().trapezoid = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: -2 * h / 6, y: 0 },
      { x: w + 2 * h / 6, y: 0 },
      { x: w - h / 6, y: -h },
      { x: h / 6, y: -h }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on left side
  render.shapes().inv_trapezoid = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: h / 6, y: 0 },
      { x: w - h / 6, y: 0 },
      { x: w + 2 * h / 6, y: -h },
      { x: -2 * h / 6, y: -h }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add custom shape for box with inverted arrow on right side
  render.shapes().rect_right_inv_arrow = function (parent, bbox, node) {
    const w = bbox.width
    const h = bbox.height
    const points = [
      { x: 0, y: 0 },
      { x: w + h / 2, y: 0 },
      { x: w, y: -h / 2 },
      { x: w + h / 2, y: -h },
      { x: 0, y: -h }
    ]
    const shapeSvg = parent.insert('polygon', ':first-child')
      .attr('points', points.map(function (d) {
        return d.x + ',' + d.y
      }).join(' '))
      .attr('transform', 'translate(' + (-w / 2) + ',' + (h * 2 / 4) + ')')
    node.intersect = function (point) {
      return dagreD3.intersect.polygon(node, points, point)
    }
    return shapeSvg
  }

  // Add our custom arrow - an empty arrowhead
  render.arrows().none = function normal (parent, id, edge, type) {
    const marker = parent.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerUnits', 'strokeWidth')
      .attr('markerWidth', 8)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    const path = marker.append('path')
      .attr('d', 'M 0 0 L 0 0 L 0 0 z')
    dagreD3.util.applyStyle(path, edge[type + 'Style'])
  }

  // Override normal arrowhead defined in d3. Remove style & add class to allow css styling.
  render.arrows().normal = function normal (parent, id, edge, type) {
    const marker = parent.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerUnits', 'strokeWidth')
      .attr('markerWidth', 8)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    marker.append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('class', 'arrowheadPath')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '1,0')
  }

  // Set up an SVG group so that we can translate the final graph.
  const svg = d3.select(`[id="${id}"]`)

  // Run the renderer. This is what draws the final graph.
  const element = d3.select('#' + id + ' g')
  render(element, g)

  element.selectAll('g.node')
    .attr('title', function () {
      return flowDb.getTooltip(this.id)
    })

  const padding = 8
  const width = g.maxX - g.minX + padding * 2
  const height = g.maxY - g.minY + padding * 2
  svg.attr('width', '100%')
  svg.attr('style', `max-width: ${width}px;`)
  svg.attr('viewBox', `0 0 ${width} ${height}`)
  svg.select('g').attr('transform', `translate(${padding - g.minX}, ${padding - g.minY})`)

  // Index nodes
  flowDb.indexNodes('subGraph' + i)

  // reposition labels
  for (i = 0; i < subGraphs.length; i++) {
    subG = subGraphs[i]

    if (subG.title !== 'undefined') {
      const clusterRects = document.querySelectorAll('#' + id + ' #' + subG.id + ' rect')
      const clusterEl = document.querySelectorAll('#' + id + ' #' + subG.id)

      const xPos = clusterRects[0].x.baseVal.value
      const yPos = clusterRects[0].y.baseVal.value
      const width = clusterRects[0].width.baseVal.value
      const cluster = d3.select(clusterEl[0])
      const te = cluster.select('.label')
      te.attr('transform', `translate(${xPos + width / 2}, ${yPos + 14})`)
      te.attr('id', id + 'Text')
    }
  }

  // Add label rects for non html labels
  if (!getConfig().flowchart.htmlLabels) {
    const labels = document.querySelectorAll('#' + id + ' .edgeLabel .label')
    for (let k = 0; k < labels.length; k++) {
      const label = labels[k]

      // Get dimensions of label
      const dim = label.getBBox()

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('rx', 0)
      rect.setAttribute('ry', 0)
      rect.setAttribute('width', dim.width)
      rect.setAttribute('height', dim.height)
      rect.setAttribute('style', 'fill:#e8e8e8;')

      label.insertBefore(rect, label.firstChild)
    }
  }
}

export default {
  setConf,
  addVertices,
  addEdges,
  getClasses,
  draw
}
