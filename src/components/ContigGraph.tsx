import { useEffect, useRef } from 'react'
import { select } from 'd3-selection'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { zoom } from 'd3-zoom'
import { drag } from 'd3-drag'
import type { D3ZoomEvent } from 'd3-zoom'
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force'
import type { ContigEdge } from '../madansix/types'

interface ContigGraphProps {
  edges: ContigEdge[]
  width?: number
  height?: number
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  degree: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: GraphNode | string
  target: GraphNode | string
}

function nodeColour(degree: number): string {
  if (degree === 1) return '#0d9488'  // teal
  if (degree === 2) return '#2563eb'  // blue
  return '#f59e0b'                    // amber (>=3)
}

function truncate(s: string, max = 12): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

export function ContigGraph({ edges, width = 600, height = 400 }: ContigGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Derive counts for display
  const nodeCount = new Set(edges.flatMap(e => [e.source, e.target])).size
  const edgeCount = edges.length

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svgSelection = select(svgEl)

    // Clear previous render
    svgSelection.selectAll('*').remove()

    if (edges.length === 0) return

    // Build node set and degree map
    const nodeIds = new Set<string>()
    const degreeMap = new Map<string, number>()
    edges.forEach(e => {
      nodeIds.add(e.source)
      nodeIds.add(e.target)
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1)
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1)
    })

    const nodes: GraphNode[] = Array.from(nodeIds).map(id => ({
      id,
      degree: degreeMap.get(id) ?? 0,
    }))

    const links: GraphLink[] = edges.map(e => ({ source: e.source, target: e.target }))

    svgSelection
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    // Zoom/pan container
    const container = svgSelection.append('g').attr('class', 'graph-container')

    svgSelection.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 5])
        .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          container.attr('transform', event.transform.toString())
        })
    )

    // Force simulation
    const simulation = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(80))
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide(24))

    // Links
    const link = container.append('g')
      .attr('class', 'graph-links')
      .attr('stroke', 'var(--gx-border)')
      .attr('stroke-width', 1.5)
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')

    // Nodes group
    const node = container.append('g')
      .attr('class', 'graph-nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node')
      .style('cursor', 'grab')

    // Drag behaviour
    const dragBehaviour = drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(dragBehaviour)

    // Circles
    node.append('circle')
      .attr('r', 10)
      .attr('fill', d => nodeColour(d.degree))
      .attr('stroke', 'var(--gx-surface)')
      .attr('stroke-width', 2)

    // Labels
    node.append('text')
      .attr('dy', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'var(--gx-text-muted)')
      .attr('font-family', 'var(--gx-font-mono)')
      .text(d => truncate(d.id))

    // Tooltip title
    node.append('title').text(d => d.id)

    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)

      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
      select(svgEl).on('.zoom', null)
    }
  }, [edges, width, height])

  if (edges.length === 0) {
    return (
      <div className="contig-graph contig-graph--empty">
        <p className="contig-graph-empty-msg">No connections found</p>
      </div>
    )
  }

  return (
    <div className="contig-graph">
      <div className="contig-graph-meta">
        <span className="contig-graph-stat">{nodeCount} contigs</span>
        <span className="contig-graph-sep">·</span>
        <span className="contig-graph-stat">{edgeCount} connections</span>
        <span className="contig-graph-legend">
          <span style={{ color: '#0d9488' }}>●</span> degree 1
          <span style={{ color: '#2563eb', marginLeft: '0.5rem' }}>●</span> degree 2
          <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>●</span> degree ≥3
        </span>
      </div>
      <svg ref={svgRef} className="contig-graph-svg" role="img" aria-label="Contig connectivity graph" />
    </div>
  )
}
